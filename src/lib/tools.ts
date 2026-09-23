const MAX_CENTS = 1_000_000_000;
function moneyToCents(value: string) {
  const text = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text))
    throw new Error('Enter a non-negative amount with at most two decimal places.');
  const [whole, fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS)
    throw new Error('That amount is too large for this local tool.');
  return cents;
}
function billTotal(amount: string, tip: string) {
  const tipText = tip.trim();
  if (tipText && (!/^\d+(?:\.\d{1,2})?$/.test(tipText) || Number(tipText) > 100))
    throw new Error('Tip must be from 0% to 100%.');
  const amountCents = moneyToCents(amount);
  const tipCents = Math.floor(
    (amountCents * Math.round(Number(tipText || 0) * 100) + 5000) / 10000,
  );
  return { amountCents, tipCents, totalCents: amountCents + tipCents };
}
export function splitBill(amount: string, tip: string, people: number) {
  if (!Number.isInteger(people) || people < 1 || people > 100)
    throw new Error('Choose between 1 and 100 people.');
  const total = billTotal(amount, tip);
  const baseShare = Math.floor(total.totalCents / people);
  const remainder = total.totalCents % people;
  return {
    ...total,
    baseShare,
    remainder,
    shares: Array.from({ length: people }, (_, i) => baseShare + (i < remainder ? 1 : 0)),
  };
}
export function splitWeightedBill(
  amount: string,
  tip: string,
  people: Array<{ name: string; weight: string }>,
) {
  if (!people.length || people.length > 100) throw new Error('Add between 1 and 100 people.');
  const weights = people.map(({ weight }) => {
    const numeric = Number(weight);
    if (
      !/^\d+(?:\.\d{1,2})?$/.test(weight.trim()) ||
      !Number.isFinite(numeric) ||
      numeric <= 0 ||
      numeric > 1000
    )
      throw new Error('Every share weight must be from 0.01 to 1000.');
    return Math.round(numeric * 100);
  });
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isSafeInteger(weightTotal)) throw new Error('Share weights are too large.');
  const total = billTotal(amount, tip);
  const raw = weights.map((weight, index) => ({
    index,
    cents: Math.floor((total.totalCents * weight) / weightTotal),
    remainder: (total.totalCents * weight) % weightTotal,
  }));
  let remaining = total.totalCents - raw.reduce((sum, share) => sum + share.cents, 0);
  [...raw]
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
    .forEach((share) => {
      if (remaining > 0) {
        raw[share.index].cents += 1;
        remaining -= 1;
      }
    });
  return {
    ...total,
    shares: people.map((person, index) => ({
      name: person.name.trim() || `Person ${index + 1}`,
      weight: weights[index] / 100,
      cents: raw[index].cents,
    })),
  };
}
export function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export type CaseMode = 'none' | 'lower' | 'upper' | 'title';
export function tidyText(
  source: string,
  options: {
    caseMode: CaseMode;
    dedupe: boolean;
    trim?: boolean;
    removeBlankLines?: boolean;
    unicode?: boolean;
  },
) {
  if (!source)
    return {
      text: '',
      removedLines: 0,
      lineCount: 0,
      characterCount: 0,
      sourceLineCount: 0,
      sourceCharacterCount: 0,
      changes: { trimmed: 0, blanks: 0, duplicates: 0, case: 0, unicode: 0 },
    };
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const seen = new Set<string>();
  const changes = { trimmed: 0, blanks: 0, duplicates: 0, case: 0, unicode: 0 };
  const cleaned = lines.flatMap((line) => {
    let next = line;
    if (options.unicode !== false) {
      const normalized = next.normalize('NFC');
      if (normalized !== next) changes.unicode += 1;
      next = normalized;
    }
    if (options.trim !== false) {
      const compact = next.trim().replace(/[\t \f\v]+/g, ' ');
      if (compact !== next) changes.trimmed += 1;
      next = compact;
    }
    const beforeCase = next;
    if (options.caseMode === 'lower') next = next.toLocaleLowerCase();
    if (options.caseMode === 'upper') next = next.toLocaleUpperCase();
    if (options.caseMode === 'title')
      next = next
        .toLocaleLowerCase()
        .replace(
          /(^|[^\p{L}\p{M}'])(\p{L})/gu,
          (_m, p: string, l: string) => `${p}${l.toLocaleUpperCase()}`,
        );
    if (next !== beforeCase) changes.case += 1;
    if (!next.trim() && options.removeBlankLines !== false) {
      changes.blanks += 1;
      return [];
    }
    if (options.dedupe && seen.has(next)) {
      changes.duplicates += 1;
      return [];
    }
    seen.add(next);
    return [next];
  });
  const text = cleaned.join('\n');
  return {
    text,
    removedLines: changes.blanks + changes.duplicates,
    lineCount: cleaned.length,
    characterCount: [...text].length,
    sourceLineCount: lines.length,
    sourceCharacterCount: [...source].length,
    changes,
  };
}
export function copyGuidance(reason: 'unavailable' | 'blocked') {
  return reason === 'unavailable'
    ? 'Copy is unavailable here. Select the result and copy it manually.'
    : 'Copy was blocked. Select the result and copy it manually.';
}
export function safeCsvCell(value: string) {
  return /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
}
export function csvDownload(rows: string[][]) {
  return rows
    .map((row) => row.map((cell) => `"${safeCsvCell(cell).replaceAll('"', '""')}"`).join(','))
    .join('\r\n');
}
export interface CsvFinding {
  row: number;
  column: number;
  source: string;
  finding: string;
  preview: string;
}
export interface CsvInspection {
  headers: string[];
  dataRows: number;
  missingCells: number;
  duplicateRows: number;
  raggedRows: number;
  formulaLikeCells: number;
  parseError: string | null;
  findings?: CsvFinding[];
  rows?: string[][];
  rowLines?: number[];
}
function parseCsv(source: string) {
  const rows: string[][] = [];
  const rowLines: number[] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let parseError: string | null = null;
  let line = 1;
  for (let i = 0; i < source.length; i += 1) {
    const character = source[i];
    if (character === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (quoted) {
        const following = source[i + 1];
        if (following && following !== ',' && following !== '\n' && following !== '\r')
          parseError ??= 'A closing quote must be followed by a comma or a new row.';
        quoted = false;
      } else if (cell === '') quoted = true;
      else {
        parseError ??= 'Quotes can only begin at the start of a CSV cell.';
        cell += character;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      rowLines.push(line);
      row = [];
      cell = '';
      line += 1;
    } else {
      cell += character;
      if (character === '\n') line += 1;
    }
  }
  if (quoted) parseError ??= 'A quoted CSV cell is missing its closing quote.';
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
    rowLines.push(line);
  }
  const records = rows
    .map((entry, index) => ({ entry, line: rowLines[index] }))
    .filter(({ entry }) => entry.some((value) => value !== ''));
  return {
    rows: records.map(({ entry }) => entry),
    rowLines: records.map(({ line: sourceLine }) => sourceLine),
    parseError,
  };
}
export function inspectCsv(source: string): CsvInspection {
  const { rows, rowLines, parseError } = parseCsv(source);
  const [headers = [], ...data] = rows;
  const signatures = new Set<string>();
  let missingCells = 0;
  let duplicateRows = 0;
  let raggedRows = 0;
  let formulaLikeCells = 0;
  for (const entry of data) {
    if (entry.length !== headers.length) raggedRows += 1;
    const key = JSON.stringify(entry);
    if (signatures.has(key)) duplicateRows += 1;
    else signatures.add(key);
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
    rows,
    rowLines,
  };
}
export function analyzeCsv(source: string) {
  const report = inspectCsv(source);
  const findings: CsvFinding[] = [];
  const seen = new Set<string>();
  report.headers.forEach((header, index) => {
    const label = header.trim();
    if (!label)
      findings.push({
        row: 1,
        column: index + 1,
        source: 'Header',
        finding: 'Empty header',
        preview: 'No column name',
      });
    else if (seen.has(label.toLocaleLowerCase()))
      findings.push({
        row: 1,
        column: index + 1,
        source: 'Header',
        finding: 'Duplicate header',
        preview: label,
      });
    else seen.add(label.toLocaleLowerCase());
  });
  const kinds = report.headers.map(() => new Set<string>());
  const duplicateRows = new Set<string>();
  (report.rows?.slice(1) ?? []).forEach((row, rowIndex) => {
    const sourceLine = report.rowLines?.[rowIndex + 1] ?? rowIndex + 2;
    const signature = JSON.stringify(row);
    if (duplicateRows.has(signature))
      findings.push({
        row: sourceLine,
        column: 0,
        source: 'Row',
        finding: 'Duplicate row',
        preview: row.map((cell) => cell.slice(0, 30)).join(' | '),
      });
    else duplicateRows.add(signature);
    if (row.length !== report.headers.length)
      findings.push({
        row: sourceLine,
        column: 0,
        source: 'Row',
        finding: 'Ragged row',
        preview: `${row.length} cells; expected ${report.headers.length}`,
      });
    row.forEach((value, column) => {
      const preview =
        value
          .replace(/[\r\n\t]/g, ' ')
          .trim()
          .slice(0, 80) || '(blank)';
      if (!value.trim())
        findings.push({
          row: sourceLine,
          column: column + 1,
          source: 'Cell',
          finding: 'Whitespace or blank field',
          preview,
        });
      if (/^[=+\-@]/.test(value.trim()))
        findings.push({
          row: sourceLine,
          column: column + 1,
          source: 'Cell',
          finding: 'Formula-like value treated as text',
          preview,
        });
      kinds[column]?.add(
        /^-?\d+(?:\.\d+)?$/.test(value.trim())
          ? 'number'
          : /^(true|false)$/i.test(value.trim())
            ? 'boolean'
            : 'text',
      );
    });
  });
  kinds.forEach((kind, column) => {
    if (kind.size > 1)
      findings.push({
        row: 0,
        column: column + 1,
        source: 'Column',
        finding: 'Cautious mixed-type hint',
        preview: Array.from(kind).join(', '),
      });
  });
  return { ...report, findings };
}
export function validateLedgerEntry(entry: { person: string; commitment: string; due: string }) {
  const errors: Record<string, string> = {};
  if (!entry.person.trim()) errors.person = 'Enter a person or team.';
  if (!entry.commitment.trim()) errors.commitment = 'Enter the commitment.';
  return errors;
}
export function weightedEvaluation(
  ratings: Array<{ a: number | null; b: number | null; weight: number }>,
) {
  const complete =
    ratings.length > 0 &&
    ratings.every(
      ({ a, b, weight }) =>
        a !== null &&
        b !== null &&
        Number.isFinite(a) &&
        Number.isFinite(b) &&
        a >= 0 &&
        a <= 5 &&
        b >= 0 &&
        b <= 5 &&
        Number.isFinite(weight) &&
        weight > 0 &&
        weight <= 1000,
    );
  if (!complete) return { complete: false, a: null, b: null, winner: null, gap: null };
  const weights = ratings.reduce((sum, item) => sum + item.weight, 0);
  const rawA = ratings.reduce((sum, item) => sum + item.a! * item.weight, 0) / weights;
  const rawB = ratings.reduce((sum, item) => sum + item.b! * item.weight, 0) / weights;
  const a = Math.round(rawA * 100) / 100;
  const b = Math.round(rawB * 100) / 100;
  return {
    complete: true,
    a,
    b,
    winner: rawA === rawB ? 'Tie' : rawA > rawB ? 'A' : 'B',
    gap: Math.abs(rawA - rawB),
  };
}
export function scoreEvaluation(ratings: Array<number | null | undefined>) {
  const valid = ratings.filter(
    (rating): rating is number =>
      typeof rating === 'number' && Number.isFinite(rating) && rating >= 0 && rating <= 5,
  );
  return valid.length ? valid.reduce((sum, rating) => sum + rating, 0) / valid.length : null;
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
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
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
  const check = new Date(rough);
  if (
    check.getUTCFullYear() !== Number(year) ||
    check.getUTCMonth() !== Number(month) - 1 ||
    check.getUTCDate() !== Number(day)
  )
    throw new Error('Choose a real calendar date.');
  const candidates: Date[] = [];
  for (let offset = -840; offset <= 840; offset += 15) {
    const candidate = new Date(rough - offset * 60_000);
    const parts = partsAt(candidate, timeZone);
    if (Object.entries(target).every(([key, value]) => parts[key] === value))
      candidates.push(candidate);
  }
  if (!candidates.length)
    throw new Error(
      'That local time does not exist in this time zone because of daylight-saving time.',
    );
  candidates.sort((a, b) => a.getTime() - b.getTime());
  return { utc: candidates[0], ambiguous: candidates.length > 1 };
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
