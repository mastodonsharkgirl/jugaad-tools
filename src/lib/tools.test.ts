import { describe, expect, it } from 'vitest';

import { copyGuidance, splitBill, tidyText, zonedDateTimeToUtc } from './tools';

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
});

describe('copyGuidance', () => {
  it('gives an explicit manual-copy fallback when clipboard access cannot be used', () => {
    expect(copyGuidance('unavailable')).toMatch(/unavailable.*manually/i);
    expect(copyGuidance('blocked')).toMatch(/blocked.*manually/i);
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
