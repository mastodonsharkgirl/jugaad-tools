const MAX_CENTS = 1_000_000_000;

function moneyToCents(value: string) {
  const trimmed = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed))
    throw new Error('Enter a non-negative amount with at most two decimal places.');
  const [whole, fraction = ''] = trimmed.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS)
    throw new Error('That amount is too large for this local tool.');
  return cents;
}

function percentToBasisPoints(value: string) {
  const trimmed = value.trim();
  if (trimmed === '') return 0;
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) throw new Error('Tip must be from 0% to 100%.');
  const [whole, fraction = ''] = trimmed.split('.');
  const basisPoints = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(basisPoints) || basisPoints > 10_000)
    throw new Error('Tip must be from 0% to 100%.');
  return basisPoints;
}

export function splitBill(amount: string, tip: string, people: number) {
  if (!Number.isInteger(people) || people < 1 || people > 100)
    throw new Error('Choose between 1 and 100 people.');
  const amountCents = moneyToCents(amount);
  const tipBasisPoints = percentToBasisPoints(tip);
  const tipCents = Math.floor((amountCents * tipBasisPoints + 5_000) / 10_000);
  const totalCents = amountCents + tipCents;
  const baseShare = Math.floor(totalCents / people);
  const remainder = totalCents % people;
  return {
    amountCents,
    tipCents,
    totalCents,
    baseShare,
    remainder,
    shares: Array.from({ length: people }, (_, i) => baseShare + (i < remainder ? 1 : 0)),
  };
}

export type CaseMode = 'none' | 'lower' | 'upper' | 'title';
export function tidyText(source: string, options: { caseMode: CaseMode; dedupe: boolean }) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const seen = new Set<string>();
  let removedLines = 0;
  const cleaned = lines.flatMap((line) => {
    let next = line
      .normalize('NFC')
      .trim()
      .replace(/[\t \f\v]+/g, ' ');
    if (options.caseMode === 'lower') next = next.toLocaleLowerCase();
    if (options.caseMode === 'upper') next = next.toLocaleUpperCase();
    if (options.caseMode === 'title')
      next = next
        .toLocaleLowerCase()
        .replace(
          /(^|[^\p{L}])(\p{L})/gu,
          (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase()}`,
        );
    if (!next || (options.dedupe && seen.has(next))) {
      removedLines += 1;
      return [];
    }
    seen.add(next);
    return [next];
  });
  return {
    text: cleaned.join('\n'),
    removedLines,
    lineCount: cleaned.length,
    characterCount: [...cleaned.join('\n')].length,
  };
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function partsAt(date: Date, timeZone: string) {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
    formatterCache.set(timeZone, formatter);
  }
  const parts = formatter.formatToParts(date);
  return Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
}

export function zonedDateTimeToUtc(local: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match) throw new Error('Choose a date and time.');
  const [, year, month, day, hour, minute] = match;
  const target = { year, month, day, hour, minute };
  const rough = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const calendarCheck = new Date(rough);
  if (
    calendarCheck.getUTCFullYear() !== Number(year) ||
    calendarCheck.getUTCMonth() !== Number(month) - 1 ||
    calendarCheck.getUTCDate() !== Number(day)
  )
    throw new Error('Choose a real calendar date.');
  const candidates: Date[] = [];
  // Modern IANA offsets are quarter-hour increments. This small set also finds repeated DST times.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = new Date(rough - offset * 60_000);
    const parts = partsAt(candidate, timeZone);
    if (Object.entries(target).every(([key, value]) => parts[key] === value))
      candidates.push(candidate);
  }
  if (!candidates.length)
    throw new Error(
      'That local time does not exist in this time zone because of daylight-saving time.',
    );
  candidates.sort((first, second) => first.getTime() - second.getTime());
  return { utc: candidates[0], ambiguous: candidates.length > 1 };
}

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function copyGuidance(reason: 'unavailable' | 'blocked') {
  return reason === 'unavailable'
    ? 'Copy is unavailable here. Select the result and copy it manually.'
    : 'Copy was blocked. Select the result and copy it manually.';
}

export interface CsvInspection {
  headers: string[];
  dataRows: number;
  missingCells: number;
  duplicateRows: number;
  raggedRows: number;
  formulaLikeCells: number;
  parseError: string | null;
}

/** Parses CSV text only; it never evaluates cells, formulas, or links. */
export function inspectCsv(source: string): CsvInspection {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let parseError: string | null = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (quoted) {
        const following = source[index + 1];
        if (following && following !== ',' && following !== '\n' && following !== '\r') {
          parseError ??= 'A closing quote must be followed by a comma or a new row.';
        }
        quoted = false;
      } else if (cell === '') {
        quoted = true;
      } else {
        parseError ??= 'Quotes can only begin at the start of a CSV cell.';
        cell += character;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (quoted) parseError ??= 'A quoted CSV cell is missing its closing quote.';
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers = [], ...data] = rows.filter((entry) => entry.some((value) => value !== ''));
  const signature = new Set<string>();
  let duplicateRows = 0;
  let missingCells = 0;
  let raggedRows = 0;
  let formulaLikeCells = 0;
  for (const entry of data) {
    if (entry.length !== headers.length) raggedRows += 1;
    const key = JSON.stringify(entry);
    if (signature.has(key)) duplicateRows += 1;
    else signature.add(key);
    for (const value of entry) {
      if (!value.trim()) missingCells += 1;
      if (/^[=+\-@]/.test(value.trim())) formulaLikeCells += 1;
    }
    missingCells += Math.max(0, headers.length - entry.length);
  }
  return {
    headers,
    dataRows: data.length,
    missingCells,
    duplicateRows,
    raggedRows,
    formulaLikeCells,
    parseError,
  };
}

export function scoreEvaluation(ratings: Array<number | null | undefined>) {
  const valid = ratings.filter(
    (rating): rating is number =>
      typeof rating === 'number' && Number.isFinite(rating) && rating >= 0 && rating <= 5,
  );
  if (!valid.length) return null;
  return valid.reduce((sum, rating) => sum + rating, 0) / valid.length;
}

export function formatInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}
