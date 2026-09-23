import { describe, expect, it } from 'vitest';

import {
  analyzeCsv,
  copyGuidance,
  formatEvaluationGap,
  generateCalendar,
  safeCsvCell,
  splitBill,
  splitWeightedBill,
  tidyText,
  validateLedgerEntry,
  weightedEvaluation,
  zonedDateTimeToUtc,
} from './tools';

describe('practical workflow helpers', () => {
  it('creates a standards-complete local calendar event with CRLF lines', () => {
    const calendar = generateCalendar({
      start: new Date('2026-07-15T13:00:00.000Z'),
      durationMinutes: 30,
      uid: 'local-test@example.invalid',
      stamp: new Date('2026-07-01T00:00:00.000Z'),
    });
    expect(calendar).toContain('UID:local-test@example.invalid\r\n');
    expect(calendar).toContain('DTSTAMP:20260701T000000Z\r\n');
    expect(calendar).toContain('DTSTART:20260715T130000Z\r\n');
    expect(calendar).toContain('DTEND:20260715T133000Z\r\n');
    expect(calendar.split('\n').every((line) => line === '' || line.endsWith('\r'))).toBe(true);
  });

  it('keeps a positive narrow manual gap visible after score rounding', () => {
    const result = weightedEvaluation([
      { a: 5, b: 5, weight: 100 },
      { a: 5, b: 4.9, weight: 1 },
    ]);
    expect(result.winner).toBe('A');
    expect(formatEvaluationGap(result.gap)).toBe('<0.01');
  });
  it('neutralises spreadsheet formulas only in an exported CSV cell', () => {
    expect(safeCsvCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(safeCsvCell('  @cmd')).toBe("'  @cmd");
    expect(safeCsvCell('ordinary text')).toBe('ordinary text');
  });

  it('finds header and mixed-value risks without changing CSV source text', () => {
    const report = analyzeCsv('name,,name\nAda,  ,1\nAda,open,true\nAda,open,2');
    expect(report.findings.some((finding) => /empty header/i.test(finding.finding))).toBe(true);
    expect(report.findings.some((finding) => /duplicate header/i.test(finding.finding))).toBe(true);
    expect(report.findings.some((finding) => /mixed/i.test(finding.finding))).toBe(true);
  });

  it('locates duplicate rows in the finding table', () => {
    const report = analyzeCsv('a,b\n1,2\n1,2');
    expect(
      report.findings.some(
        (finding) => finding.row === 3 && /duplicate row/i.test(finding.finding),
      ),
    ).toBe(true);
  });

  it('uses physical source rows after blank CSV records', () => {
    const report = analyzeCsv('a,b\n\nok,');
    expect(
      report.findings.some((finding) => finding.row === 3 && /blank field/i.test(finding.finding)),
    ).toBe(true);
  });

  it('requires each ledger field that creates a commitment', () => {
    expect(validateLedgerEntry({ person: ' ', commitment: '', due: '' })).toEqual({
      person: 'Enter a person or team.',
      commitment: 'Enter the commitment.',
    });
  });

  it('keeps zero scores and waits for complete weighted ratings', () => {
    expect(
      weightedEvaluation([
        { a: 0, b: 5, weight: 2 },
        { a: null, b: 4, weight: 1 },
      ]),
    ).toEqual({
      complete: false,
      a: null,
      b: null,
      winner: null,
      gap: null,
    });
    expect(
      weightedEvaluation([
        { a: 0, b: 5, weight: 2 },
        { a: 3, b: 3, weight: 1 },
      ]),
    ).toMatchObject({
      complete: true,
      a: 1,
      b: 4.33,
      winner: 'B',
    });
  });

  it('does not turn a small weighted gap into a rounded tie', () => {
    expect(
      weightedEvaluation([
        { a: 5, b: 5, weight: 100 },
        { a: 5, b: 4.9, weight: 1 },
      ]).winner,
    ).toBe('A');
  });

  it('rejects out-of-range ratings and huge finite weights as incomplete', () => {
    expect(weightedEvaluation([{ a: 6, b: 4, weight: 1 }]).complete).toBe(false);
    expect(weightedEvaluation([{ a: 5, b: 4, weight: 1e308 }]).complete).toBe(false);
  });

  it('reconciles unequal weighted shares exactly in paisa', () => {
    const result = splitWeightedBill('10.00', '0', [
      { name: 'Asha', weight: '1' },
      { name: 'Dev', weight: '2' },
    ]);
    expect(result.shares.map((share) => share.cents)).toEqual([333, 667]);
    expect(result.shares.reduce((sum, share) => sum + share.cents, 0)).toBe(result.totalCents);
    expect(() =>
      splitWeightedBill('10', '0', [{ name: 'Asha', weight: '999999999999999999999999' }]),
    ).toThrow();
  });

  it('treats empty Text Tidy input as zero source and result characters', () => {
    expect(
      tidyText('', {
        trim: true,
        removeBlankLines: true,
        dedupe: true,
        caseMode: 'none',
        unicode: true,
      }),
    ).toMatchObject({
      sourceLineCount: 0,
      sourceCharacterCount: 0,
      lineCount: 0,
      characterCount: 0,
      removedLines: 0,
    });
  });

  it('removes whitespace-only blank lines even when spacing cleanup is off', () => {
    expect(
      tidyText('keep\n   \nnext', {
        trim: false,
        removeBlankLines: true,
        dedupe: false,
        caseMode: 'none',
        unicode: false,
      }).text,
    ).toBe('keep\nnext');
  });
});

describe('splitBill', () => {
  it('uses integer cents and gives the first people the extra cents', () => {
    expect(splitBill('10.00', '0', 3)).toMatchObject({ totalCents: 1000, shares: [334, 333, 333] });
  });

  it('includes a percentage tip without floating point drift', () => {
    expect(splitBill('19.99', '10', 2)).toMatchObject({ totalCents: 2199, shares: [1100, 1099] });
    expect(splitBill('2.50', '64.60', 1)).toMatchObject({ tipCents: 162, totalCents: 412 });
  });

  it('rejects negative, malformed and unsafe values', () => {
    expect(() => splitBill('-1', '0', 2)).toThrow();
    expect(() => splitBill('12.999', '0', 2)).toThrow();
    expect(() => splitBill('10000001', '0', 2)).toThrow();
    expect(() => splitBill('10', '-1', 2)).toThrow();
  });
});

describe('tidyText', () => {
  it('normalises whitespace, trims lines and removes duplicate Unicode lines', () => {
    const result = tidyText('  Cafe\u0301  \n\nCaf\u00e9\n  hello   world  ', {
      caseMode: 'none',
      dedupe: true,
    });
    expect(result.text).toBe('Caf\u00e9\nhello world');
    expect(result.removedLines).toBe(2);
  });

  it('can change case without losing line boundaries', () => {
    expect(tidyText('hello\nWORLD', { caseMode: 'title', dedupe: false }).text).toBe(
      'Hello\nWorld',
    );
  });

  it('title-cases combining marks and apostrophes as parts of a word', () => {
    expect(
      tidyText("a\u0301bc don't", { caseMode: 'title', dedupe: false, unicode: false }).text,
    ).toBe("A\u0301bc Don't");
  });
});

describe('copyGuidance', () => {
  it('gives an explicit manual-copy fallback when clipboard access cannot be used', () => {
    expect(copyGuidance('unavailable')).toMatch(/unavailable.*manually/i);
    expect(copyGuidance('blocked')).toMatch(/blocked.*manually/i);
  });
});

describe('inspectCsv', () => {
  it('handles quoted commas and newlines while surfacing useful data-quality findings', async () => {
    const { inspectCsv } = await import('./tools');
    const result = inspectCsv('name,note\nAda,"one, two"\nAda,"line one\nline two"\nBob,');
    expect(result.headers).toEqual(['name', 'note']);
    expect(result.dataRows).toBe(3);
    expect(result.duplicateRows).toBe(0);
    expect(result.missingCells).toBe(1);
  });

  it('reports ragged rows without interpreting spreadsheet formulas', async () => {
    const { inspectCsv } = await import('./tools');
    const result = inspectCsv('a,b\n=SUM(A1:A2),two,extra');
    expect(result.raggedRows).toBe(1);
    expect(result.formulaLikeCells).toBe(1);
  });

  it('counts omitted ragged cells as missing and surfaces malformed quotes', async () => {
    const { inspectCsv } = await import('./tools');
    const result = inspectCsv('a,b,c\nAda,open\nBob,"unfinished');
    expect(result.missingCells).toBe(2);
    expect(result.raggedRows).toBe(2);
    expect(result.parseError).toMatch(/missing its closing quote/i);
  });
});

describe('scoreEvaluation', () => {
  it('computes a transparent average from manual ratings', async () => {
    const { scoreEvaluation } = await import('./tools');
    expect(scoreEvaluation([5, 3, 4])).toBeCloseTo(4);
    expect(scoreEvaluation([0, 4, null])).toBeCloseTo(2);
    expect(scoreEvaluation([])).toBeNull();
  });
});

describe('zonedDateTimeToUtc', () => {
  it('handles a day rollover between IANA zones', () => {
    const result = zonedDateTimeToUtc('2026-01-15T09:00', 'Asia/Kolkata');
    expect(
      new Intl.DateTimeFormat('en-CA', {
        dateStyle: 'short',
        timeStyle: 'short',
        timeZone: 'America/Los_Angeles',
      }).format(result.utc),
    ).toContain('2026-01-14');
  });

  it('uses the correct DST offset and rejects skipped wall times', () => {
    expect(zonedDateTimeToUtc('2026-07-15T09:00', 'America/New_York').utc.toISOString()).toBe(
      '2026-07-15T13:00:00.000Z',
    );
    expect(() => zonedDateTimeToUtc('2026-03-08T02:30', 'America/New_York')).toThrow(
      /does not exist/i,
    );
  });

  it('chooses the earlier occurrence when daylight-saving time repeats an hour', () => {
    const result = zonedDateTimeToUtc('2026-11-01T01:30', 'America/New_York');
    expect(result.utc.toISOString()).toBe('2026-11-01T05:30:00.000Z');
    expect(result.ambiguous).toBe(true);
  });
});
