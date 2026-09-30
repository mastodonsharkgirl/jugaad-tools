import { describe, expect, it } from 'vitest';
import {
  addPreference,
  addRequired,
  captureJudgment,
  createReview,
  decisionFor,
  judgmentState,
  reviewCsv,
  reviewJson,
  ratePreference,
  updateRequired,
  updateDocument,
  updatePreferences,
  validationErrors,
} from './evidence-review';

describe('evidence review', () => {
  it('does not let a high preference score override a failed required check', () => {
    let review = createReview({
      source: 'Only promise what the notes support.',
      drafts: ['We guarantee results.', 'We will share the current status.'],
      required: ['Supported by notes'],
      preferences: [{ label: 'Clear', weight: 1, a: 5, b: 1 }],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Fail',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'Guarantee is unsupported.',
    });
    review = captureJudgment(review, {
      candidate: 1,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'Status wording is supported.',
    });
    expect(decisionFor(review).recommendation).toBe('B');
    expect(decisionFor(review).candidates[0].state).toBe('Needs changes');
  });

  it('keeps an edited and restored document judgment outdated', () => {
    let review = createReview({
      source: 'Note',
      drafts: ['Draft A', 'Draft B'],
      required: ['Check'],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'Reviewed.',
    });
    review = updateDocument(review, 'draftA', 'Changed A');
    review = updateDocument(review, 'draftA', 'Draft A');
    expect(decisionFor(review).candidates[0].state).toBe('Review outdated');
    expect(review.judgments[0].draftRevision).toBe(1);
    expect(review.documents.draftA.revision).toBe(3);
  });

  it('rejects missing references, reasons and over-limit documents', () => {
    const review = createReview({ source: '', drafts: ['', ''], required: ['Check'] });
    expect(
      captureJudgment(review, {
        candidate: 0,
        check: 0,
        status: 'Pass',
        sourcePassage: 1,
        draftPassage: 1,
        reason: '',
      }).errors.length,
    ).toBeGreaterThan(0);
    expect(updateDocument(review, 'source', 'x'.repeat(20_001)).errors).toContain(
      'Source notes must be 20,000 characters or fewer.',
    );
  });

  it('exports snapshots and formula-safe incomplete state', () => {
    const review = createReview({
      source: '=note',
      drafts: ['+draft', 'draft B'],
      required: ['Check'],
    });
    const json = JSON.parse(reviewJson(review));
    expect(json.version).toBe(2);
    expect(json.documents.source.text).toBe('=note');
    expect(reviewCsv(review)).toContain("'=note");
    expect(reviewCsv(review)).toContain('Unreviewed');
  });

  it('blocks a sole recommendation until the other draft has a current failed review', () => {
    let review = createReview({
      source: 'Note',
      drafts: ['A', 'B'],
      required: ['Check'],
      preferences: [{ label: 'Clear', weight: 1, a: 1, b: 1 }],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'ok',
    });
    expect(decisionFor(review).recommendation).toBeNull();
    review = captureJudgment(review, {
      candidate: 1,
      check: 0,
      status: 'Fail',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'no',
    });
    expect(decisionFor(review).recommendation).toBe('A');
  });

  it('retains an immutable old judgment label and passage quote', () => {
    let review = createReview({
      source: 'Source quote',
      drafts: ['Draft quote', 'B'],
      required: ['Accuracy'],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'reason',
    });
    review = updateRequired(review, ['Tone']);
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'fresh',
    });
    expect(review.judgments).toHaveLength(2);
    expect(review.judgments[0]).toMatchObject({
      checkLabel: 'Accuracy',
      sourceText: 'Source quote',
      draftText: 'Draft quote',
    });
    expect(reviewCsv(review)).toContain('Accuracy');
  });

  it('Important 1: only recommends one draft after the other has a current failed review', () => {
    let review = createReview({
      source: 'Only promise what the notes support.',
      drafts: ['We guarantee results.', 'We will share the current status.'],
      required: ['Supported by notes'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'The reviewer recorded this manual judgment.',
    });
    expect(decisionFor(review).recommendation).toBeNull();

    review = captureJudgment(review, {
      candidate: 1,
      check: 0,
      status: 'Fail',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'The other draft has a current failed review.',
    });
    expect(decisionFor(review).recommendation).toBe('A');

    review = updateDocument(review, 'draftB', 'A revised Draft B.');
    expect(decisionFor(review).recommendation).toBeNull();
  });

  it('Important 2: preserves stale ratings visibly and never revives them after a fresh required review', () => {
    let review = createReview({
      source: 'Only promise what the notes support.',
      drafts: ['We guarantee results.', 'We will share the current status.'],
      required: ['Supported by notes'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    review = ratePreference(review, 0, 0, 5);
    review = ratePreference(review, 0, 1, 1);
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'A passes.',
    });
    review = captureJudgment(review, {
      candidate: 1,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'B passes.',
    });
    expect(decisionFor(review).recommendation).toBe('A');

    review = updateDocument(review, 'draftA', 'We guarantee results after a rewrite.');
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'This replacement review is deliberately fresh.',
    });

    const ratings =
      (
        decisionFor(review) as unknown as {
          ratings?: Array<{ a: { state: string; value: number | null } }>;
        }
      ).ratings ?? [];
    expect(ratings).toHaveLength(1);
    expect(ratings[0].a).toMatchObject({ state: 'Outdated', value: 5 });
    expect(decisionFor(review).recommendation).toBeNull();
  });

  it('Important 2: preference definition edits retain the old rating as outdated instead of relabelling it current', () => {
    let review = createReview({
      source: 'Source',
      drafts: ['A', 'B'],
      required: ['Check'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    review = ratePreference(review, 0, 0, 5);
    review = ratePreference(review, 0, 1, 1);
    review = updatePreferences(
      review,
      review.preferences.map((preference) => ({ ...preference, label: 'Concision' })),
    );

    expect(review.preferences[0].a).toBe(5);
    const ratings =
      (
        decisionFor(review) as unknown as {
          ratings?: Array<{ a: { state: string; value: number | null } }>;
        }
      ).ratings ?? [];
    expect(ratings[0].a).toMatchObject({ state: 'Outdated', value: 5 });
  });

  it('Important 3: global validation rejects invalid scores before a sole eligible draft can be recommended', () => {
    let review = createReview({
      source: 'Source',
      drafts: ['A', 'B'],
      required: ['Check'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'A passes.',
    });
    review = captureJudgment(review, {
      candidate: 1,
      check: 0,
      status: 'Fail',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'B fails.',
    });
    review = {
      ...review,
      preferences: [{ ...review.preferences[0], a: 6 }],
    };

    expect(validationErrors(review)).toContain('Use preference scores from 0 to 5.');
    expect(decisionFor(review).recommendation).toBeNull();
  });

  it('Important 4: retains immutable saved history with a stable check id and original label after criteria edits', () => {
    let review = createReview({
      source: 'Only promise what the notes support.',
      drafts: ['We guarantee results.', 'We will share the current status.'],
      required: ['Supported by notes'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'The old judgment is retained.',
    });
    const original = review.judgments[0] as unknown as { checkId?: string };
    expect(original.checkId).toEqual(expect.any(String));

    review = updateRequired(review, ['Tone']);
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'The new judgment is separate.',
    });
    expect(review.judgments).toHaveLength(2);
    expect(review.judgments[0]).toMatchObject({
      checkId: original.checkId,
      checkLabel: 'Supported by notes',
      sourceText: 'Only promise what the notes support.',
      draftText: 'We guarantee results.',
    });
  });

  it('Important 5 and 7: captures only documents cited by saved reviews, never each unsaved edit', () => {
    let review = createReview({
      source: 'Source',
      drafts: ['Draft A', 'Draft B'],
      required: ['Check'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    review = updateDocument(review, 'source', 'An unsaved first edit.');
    review = updateDocument(review, 'source', 'The retained saved source note.');
    expect((review as unknown as { snapshots?: unknown[] }).snapshots ?? []).toHaveLength(0);

    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Fail',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'This review captures the exact current documents.',
    });
    const snapshots =
      (
        review as unknown as {
          snapshots?: Array<{ key: string; revision: number; text: string }>;
        }
      ).snapshots ?? [];
    expect(snapshots).toEqual(
      expect.arrayContaining([
        { key: 'source', revision: 3, text: 'The retained saved source note.' },
        { key: 'draftA', revision: 1, text: 'Draft A' },
      ]),
    );
    expect(snapshots).toHaveLength(2);
  });

  it('Important 5: add and remove controls keep criteria identities unique, enforce limits, and invalidate dependent reviews and ratings', () => {
    let review = createReview({
      source: 'Source',
      drafts: ['Draft A', 'Draft B'],
      required: ['Accuracy'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'Accuracy was reviewed.',
    });
    review = ratePreference(review, 0, 0, 4);

    for (let index = 2; index <= 8; index += 1) {
      review = addRequired(review, `Check ${index}`);
      review = addPreference(review, `Preference ${index}`);
    }

    expect(review.required).toHaveLength(8);
    expect(new Set(review.required.map((check) => check.id)).size).toBe(8);
    expect(review.preferences).toHaveLength(8);
    expect(new Set(review.preferences.map((preference) => preference.id)).size).toBe(8);
    expect(judgmentState(review, review.judgments[0])).toBe('Outdated');
    expect(decisionFor(review).ratings[0].a.state).toBe('Outdated');

    expect(addRequired(review, 'Too many')).toHaveProperty('required.length', 8);
    expect(addPreference(review, 'Too many')).toHaveProperty('preferences.length', 8);
  });

  it('Important 6: JSON and formula-safe CSV carry matching rating, validation, provenance, and current-state fields', () => {
    let review = createReview({
      source: 'Source',
      drafts: ['Draft A', 'Draft B'],
      required: ['Supported by notes'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    review = ratePreference(review, 0, 0, 5);
    review = ratePreference(review, 0, 1, 1);
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Fail',
      sourcePassage: 1,
      draftPassage: 1,
      reason: '=unsupported promise',
    });
    review = updateDocument(review, 'draftA', 'Changed draft A.');

    const json = JSON.parse(reviewJson(review));
    const csv = reviewCsv(review);
    expect(json.version).toBe(2);
    expect(json.judgments[0].checkLabel).toBe('Supported by notes');
    expect(json.judgments[0].state).toBe('Outdated');
    expect(json.snapshots).toHaveLength(2);
    expect(csv).toContain('rating state');
    expect(csv).toContain('validation error');
    expect(csv).toContain('Outdated');
    expect(csv).toContain("'=unsupported promise");
  });

  it('Important 8 and V4: explains both failed drafts and a completed weighted tie without generic blocked wording', () => {
    let failed = createReview({
      source: 'Source',
      drafts: ['Draft A', 'Draft B'],
      required: ['Check'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    failed = captureJudgment(failed, {
      candidate: 0,
      check: 0,
      status: 'Fail',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'A fails.',
    });
    failed = captureJudgment(failed, {
      candidate: 1,
      check: 0,
      status: 'Fail',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'B fails.',
    });
    const failedDecision = decisionFor(failed) as unknown as { message?: string };
    expect(failedDecision.message).toBe(
      'Neither draft meets the required checks. Revise a draft and save fresh reviews.',
    );

    let tied = createReview({
      source: 'Source',
      drafts: ['Draft A', 'Draft B'],
      required: ['Check'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    tied = ratePreference(tied, 0, 0, 3);
    tied = ratePreference(tied, 0, 1, 3);
    tied = captureJudgment(tied, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'A passes.',
    });
    tied = captureJudgment(tied, {
      candidate: 1,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'B passes.',
    });
    const tieDecision = decisionFor(tied) as unknown as { message?: string };
    expect(decisionFor(tied).recommendation).toBe('Tie');
    expect(tieDecision.message).toBe(
      'Tie — both eligible drafts have equal completed weighted scores.',
    );
  });

  it('treats valid zero ratings supplied at creation as current ratings', () => {
    let review = createReview({
      source: 'Source',
      drafts: ['Draft A', 'Draft B'],
      required: ['Check'],
      preferences: [{ label: 'Clear', weight: 1, a: 0, b: 0 }],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'A passes.',
    });
    review = captureJudgment(review, {
      candidate: 1,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'B passes.',
    });

    expect(decisionFor(review).recommendation).toBe('Tie');
  });

  it('round 2 Important 1: preserves duplicate history but makes only the latest matching judgment active everywhere', () => {
    let review = createReview({
      source: 'Source note.',
      drafts: ['Draft A.', 'Draft B.'],
      required: ['Supported by notes'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'First current judgment.',
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Fail',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'Replacement current judgment.',
    });

    expect(review.judgments).toHaveLength(2);
    expect(judgmentState(review, review.judgments[0])).toBe('Superseded');
    expect(judgmentState(review, review.judgments[1])).toBe('Current');
    expect(decisionFor(review).candidates[0].state).toBe('Needs changes');

    const json = JSON.parse(reviewJson(review));
    expect(json.judgments.map((judgment: { state: string }) => judgment.state)).toEqual([
      'Superseded',
      'Current',
    ]);
    expect(json.judgments.map((judgment: { active: boolean }) => judgment.active)).toEqual([
      false,
      true,
    ]);
    const csv = reviewCsv(review);
    expect(csv).toContain('"active judgment"');
    expect(csv).toContain('"Superseded","false"');
    expect(csv).toContain('"Current","true"');
  });

  it('round 2 Important 2: leaves partial current coverage unreviewed and reserves outdated for a relevant stale check', () => {
    let review = createReview({
      source: 'Source note.',
      drafts: ['Draft A.', 'Draft B.'],
      required: ['Accuracy', 'Tone'],
      preferences: [{ label: 'Clear', weight: 1, a: null, b: null }],
    });
    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'Only the first check has been reviewed.',
    });

    expect(decisionFor(review).candidates[0].state).toBe('Unreviewed');

    review = updateDocument(review, 'draftA', 'Edited Draft A.');
    expect(decisionFor(review).candidates[0].state).toBe('Review outdated');

    review = captureJudgment(review, {
      candidate: 0,
      check: 0,
      status: 'Pass',
      sourcePassage: 1,
      draftPassage: 1,
      reason: 'The stale first check was deliberately re-reviewed.',
    });
    expect(decisionFor(review).candidates[0].state).toBe('Unreviewed');

    review = updateDocument(review, 'draftA', 'Edited Draft A again.');
    expect(decisionFor(review).candidates[0].state).toBe('Review outdated');
  });
});
