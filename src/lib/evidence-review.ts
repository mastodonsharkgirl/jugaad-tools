import { csvDownload, weightedEvaluation } from './tools';

export type Candidate = 0 | 1;
export type JudgmentStatus = 'Pass' | 'Fail';
export type DocumentKey = 'source' | 'draftA' | 'draftB';
export type ReviewState = 'Unreviewed' | 'Needs changes' | 'Meets your checks' | 'Review outdated';
export type RecordState = 'Current' | 'Outdated';
export type JudgmentState = RecordState | 'Superseded';
export type RatingState = 'Unrated' | RecordState;

export interface RevisionedDocument {
  text: string;
  revision: number;
}

export interface RequiredCheck {
  id: string;
  label: string;
}

export interface RatingRevision {
  source: number;
  draft: number;
  definition: number;
}

export interface Preference {
  id: string;
  label: string;
  weight: number;
  a: number | null;
  b: number | null;
  aRevision?: RatingRevision;
  bRevision?: RatingRevision;
}

type PreferenceInput = Omit<Preference, 'id'> & { id?: string };

export interface DocumentSnapshot {
  key: DocumentKey;
  revision: number;
  text: string;
}

export interface RequiredJudgment {
  candidate: Candidate;
  /** The position shown when this review was saved; logic uses checkId instead. */
  check: number;
  checkId: string;
  checkLabel: string;
  status: JudgmentStatus;
  sourcePassage: number;
  draftPassage: number;
  reason: string;
  sourceRevision: number;
  draftRevision: number;
  requiredRevision: number;
  sourceText: string;
  draftText: string;
}

export interface CaptureInput {
  candidate: Candidate;
  check: number;
  status: JudgmentStatus;
  sourcePassage: number;
  draftPassage: number;
  reason: string;
}

export interface Review {
  documents: Record<DocumentKey, RevisionedDocument>;
  required: RequiredCheck[];
  requiredRevision: number;
  preferences: Preference[];
  preferenceRevision: number;
  judgments: RequiredJudgment[];
  /** Full-document snapshots exist only for revisions that a saved judgment cites. */
  snapshots: DocumentSnapshot[];
  nextCheckId: number;
  nextPreferenceId: number;
  errors: string[];
}

const document = (text = ''): RevisionedDocument => ({ text, revision: 1 });

export const numberedPassages = (text: string) =>
  text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((text, index) => ({ passage: index + 1, text }));

const passages = (text: string) => numberedPassages(text).map((item) => item.text);
const candidateDocumentKey = (candidate: Candidate): DocumentKey =>
  candidate === 0 ? 'draftA' : 'draftB';
const candidateLabel = (candidate: Candidate) => (candidate === 0 ? 'A' : 'B');
const documentLabel = (key: DocumentKey) =>
  key === 'source' ? 'Source notes' : key === 'draftA' ? 'Draft A' : 'Draft B';
const validScore = (value: number | null) =>
  value === null || (Number.isFinite(value) && value >= 0 && value <= 5);

const documentErrors = (key: DocumentKey, text: string) => {
  const errors: string[] = [];
  if (text.length > 20_000)
    errors.push(`${documentLabel(key)} must be 20,000 characters or fewer.`);
  if (passages(text).length > 100)
    errors.push(`${documentLabel(key)} must have 100 nonempty passages or fewer.`);
  return errors;
};

const requiredErrors = (required: RequiredCheck[]) => {
  const errors: string[] = [];
  if (required.length < 1 || required.length > 8)
    errors.push('Add 1 to 8 required checks, each up to 120 characters.');
  if (required.some((check) => !check.label.trim() || check.label.length > 120))
    errors.push('Add 1 to 8 required checks, each up to 120 characters.');
  if (new Set(required.map((check) => check.id)).size !== required.length)
    errors.push('Each required check must keep its own review identity.');
  return [...new Set(errors)];
};

const preferenceErrors = (preferences: Preference[]) => {
  const errors: string[] = [];
  if (preferences.length < 1 || preferences.length > 8)
    errors.push('Add 1 to 8 valid weighted preferences.');
  if (
    preferences.some(
      (item) =>
        !item.label.trim() ||
        item.label.length > 120 ||
        !Number.isFinite(item.weight) ||
        item.weight <= 0 ||
        item.weight > 1000,
    )
  )
    errors.push('Add 1 to 8 valid weighted preferences.');
  if (new Set(preferences.map((preference) => preference.id)).size !== preferences.length)
    errors.push('Each weighted preference must keep its own rating identity.');
  if (preferences.some((item) => !validScore(item.a) || !validScore(item.b)))
    errors.push('Use preference scores from 0 to 5.');
  return [...new Set(errors)];
};

const revisionFor = (review: Review, candidate: Candidate): RatingRevision => ({
  source: review.documents.source.revision,
  draft: review.documents[candidateDocumentKey(candidate)].revision,
  definition: review.preferenceRevision,
});

const initialPreference = (input: PreferenceInput, id: string): Preference => {
  const hasA = input.a !== null && input.a !== undefined;
  const hasB = input.b !== null && input.b !== undefined;

  return {
    id,
    label: input.label,
    weight: input.weight,
    a: input.a ?? null,
    b: input.b ?? null,
    aRevision: hasA ? (input.aRevision ?? { source: 1, draft: 1, definition: 1 }) : undefined,
    bRevision: hasB ? (input.bRevision ?? { source: 1, draft: 1, definition: 1 }) : undefined,
  };
};

export function createReview(
  input: {
    source?: string;
    drafts?: [string, string];
    required?: string[];
    preferences?: PreferenceInput[];
  } = {},
): Review {
  const requiredLabels = input.required ?? [''];
  const preferenceInputs = input.preferences ?? [{ label: '', weight: 1, a: null, b: null }];
  const review: Review = {
    documents: {
      source: document(input.source ?? ''),
      draftA: document(input.drafts?.[0] ?? ''),
      draftB: document(input.drafts?.[1] ?? ''),
    },
    required: requiredLabels.map((label, index) => ({ id: `check-${index + 1}`, label })),
    requiredRevision: 1,
    preferences: preferenceInputs.map((preference, index) =>
      initialPreference(preference, preference.id ?? `preference-${index + 1}`),
    ),
    preferenceRevision: 1,
    judgments: [],
    snapshots: [],
    nextCheckId: requiredLabels.length + 1,
    nextPreferenceId: preferenceInputs.length + 1,
    errors: [],
  };
  return { ...review, errors: validationErrors(review) };
}

export function resetReview() {
  return createReview();
}

export function updateDocument(review: Review, key: DocumentKey, text: string): Review {
  const previous = review.documents[key];
  if (previous.text === text) return review;
  const changed = {
    ...review,
    documents: {
      ...review.documents,
      [key]: { text, revision: previous.revision + 1 },
    },
  };
  return { ...changed, errors: validationErrors(changed) };
}

export function updateRequired(review: Review, required: Array<string | RequiredCheck>): Review {
  let nextCheckId = review.nextCheckId;
  const normalized = required.map((item, index) => {
    if (typeof item !== 'string') return item;
    const existing = review.required[index];
    if (existing) return { ...existing, label: item };
    const id = `check-${nextCheckId}`;
    nextCheckId += 1;
    return { id, label: item };
  });
  const definitionsChanged =
    normalized.length !== review.required.length ||
    normalized.some(
      (item, index) =>
        item.id !== review.required[index]?.id || item.label !== review.required[index]?.label,
    );
  const changed = {
    ...review,
    required: normalized,
    requiredRevision: definitionsChanged ? review.requiredRevision + 1 : review.requiredRevision,
    nextCheckId,
  };
  return { ...changed, errors: validationErrors(changed) };
}

export function addRequired(review: Review, label = ''): Review {
  if (review.required.length >= 8) return review;
  return updateRequired({ ...review, nextCheckId: review.nextCheckId + 1 }, [
    ...review.required,
    { id: `check-${review.nextCheckId}`, label },
  ]);
}

export function removeRequired(review: Review, id: string): Review {
  if (review.required.length <= 1) return review;
  return updateRequired(
    review,
    review.required.filter((check) => check.id !== id),
  );
}

export function updatePreferences(review: Review, preferences: PreferenceInput[]): Review {
  let nextPreferenceId = review.nextPreferenceId;
  const normalized = preferences.map((item, index) => {
    const existing = review.preferences[index];
    const id = item.id ?? existing?.id ?? `preference-${nextPreferenceId++}`;
    return {
      id,
      label: item.label,
      weight: item.weight,
      a: item.a ?? null,
      b: item.b ?? null,
      aRevision: item.aRevision,
      bRevision: item.bRevision,
    };
  });
  const definitionsChanged =
    normalized.length !== review.preferences.length ||
    normalized.some(
      (item, index) =>
        item.id !== review.preferences[index]?.id ||
        item.label !== review.preferences[index]?.label ||
        item.weight !== review.preferences[index]?.weight,
    );
  const changed = {
    ...review,
    preferences: normalized,
    preferenceRevision: definitionsChanged
      ? review.preferenceRevision + 1
      : review.preferenceRevision,
    nextPreferenceId,
  };
  return { ...changed, errors: validationErrors(changed) };
}

export function addPreference(review: Review, label = ''): Review {
  if (review.preferences.length >= 8) return review;
  return updatePreferences({ ...review, nextPreferenceId: review.nextPreferenceId + 1 }, [
    ...review.preferences,
    { id: `preference-${review.nextPreferenceId}`, label, weight: 1, a: null, b: null },
  ]);
}

export function removePreference(review: Review, id: string): Review {
  if (review.preferences.length <= 1) return review;
  return updatePreferences(
    review,
    review.preferences.filter((preference) => preference.id !== id),
  );
}

export function ratePreference(
  review: Review,
  index: number,
  candidate: Candidate,
  score: number | null,
): Review {
  const revision = score === null ? undefined : revisionFor(review, candidate);
  const changed = {
    ...review,
    preferences: review.preferences.map((preference, preferenceIndex) =>
      preferenceIndex !== index
        ? preference
        : candidate === 0
          ? { ...preference, a: score, aRevision: revision }
          : { ...preference, b: score, bRevision: revision },
    ),
  };
  return { ...changed, errors: validationErrors(changed) };
}

const snapshot = (snapshots: DocumentSnapshot[], key: DocumentKey, value: RevisionedDocument) =>
  snapshots.some((item) => item.key === key && item.revision === value.revision)
    ? snapshots
    : [...snapshots, { key, revision: value.revision, text: value.text }];

export function captureJudgment(review: Review, input: CaptureInput): Review {
  const check = review.required[input.check];
  const candidateKey = candidateDocumentKey(input.candidate);
  const next: RequiredJudgment = {
    ...input,
    checkId: check?.id ?? '',
    checkLabel: check?.label ?? '',
    reason: input.reason.trim(),
    sourceRevision: review.documents.source.revision,
    draftRevision: review.documents[candidateKey].revision,
    requiredRevision: review.requiredRevision,
    sourceText: passages(review.documents.source.text)[input.sourcePassage - 1] ?? '',
    draftText: passages(review.documents[candidateKey].text)[input.draftPassage - 1] ?? '',
  };
  const errors: string[] = [];
  if (!check?.label.trim()) errors.push('Choose a required check.');
  if (!next.sourceText) errors.push('Choose a source passage.');
  if (!next.draftText) errors.push('Choose a draft passage.');
  if (!next.reason || next.reason.length > 1000)
    errors.push('Add a reason of 1 to 1,000 characters.');
  errors.push(...documentErrors('source', review.documents.source.text));
  errors.push(...documentErrors(candidateKey, review.documents[candidateKey].text));
  if (errors.length) return { ...review, errors: [...new Set(errors)] };

  const snapshots = snapshot(
    snapshot(review.snapshots, 'source', review.documents.source),
    candidateKey,
    review.documents[candidateKey],
  );
  const changed = { ...review, judgments: [...review.judgments, next], snapshots };
  return { ...changed, errors: validationErrors(changed) };
}

export function validationErrors(review: Review) {
  return [
    ...(Object.keys(review.documents) as DocumentKey[]).flatMap((key) =>
      documentErrors(key, review.documents[key].text),
    ),
    ...requiredErrors(review.required),
    ...preferenceErrors(review.preferences),
  ];
}

const hasCurrentJudgmentRevision = (review: Review, judgment: RequiredJudgment) => {
  const draft = review.documents[candidateDocumentKey(judgment.candidate)];
  const checkStillExists = review.required.some((check) => check.id === judgment.checkId);
  return (
    judgment.sourceRevision === review.documents.source.revision &&
    judgment.draftRevision === draft.revision &&
    judgment.requiredRevision === review.requiredRevision &&
    checkStillExists
  );
};

const latestCurrentJudgment = (review: Review, candidate: Candidate, checkId: string) =>
  [...review.judgments]
    .reverse()
    .find(
      (judgment) =>
        judgment.candidate === candidate &&
        judgment.checkId === checkId &&
        hasCurrentJudgmentRevision(review, judgment),
    ) ?? null;

export function judgmentState(review: Review, judgment: RequiredJudgment): JudgmentState {
  if (!hasCurrentJudgmentRevision(review, judgment)) return 'Outdated';
  return latestCurrentJudgment(review, judgment.candidate, judgment.checkId) === judgment
    ? 'Current'
    : 'Superseded';
}

const currentJudgment = (review: Review, candidate: Candidate, checkId: string) =>
  latestCurrentJudgment(review, candidate, checkId);

const candidateState = (review: Review, candidate: Candidate): ReviewState => {
  const candidateKey = candidateDocumentKey(candidate);
  const judgments = review.required.map((check) => currentJudgment(review, candidate, check.id));
  const hasRelevantStaleJudgment = review.required.some(
    (check, index) =>
      !judgments[index] &&
      review.judgments.some(
        (judgment) =>
          judgment.candidate === candidate &&
          judgment.checkId === check.id &&
          judgmentState(review, judgment) === 'Outdated',
      ),
  );
  if (
    !review.documents.source.text.trim() ||
    !review.documents[candidateKey].text.trim() ||
    documentErrors('source', review.documents.source.text).length ||
    documentErrors(candidateKey, review.documents[candidateKey].text).length ||
    requiredErrors(review.required).length
  )
    return hasRelevantStaleJudgment ? 'Review outdated' : 'Unreviewed';

  if (judgments.some((judgment) => !judgment))
    return hasRelevantStaleJudgment ? 'Review outdated' : 'Unreviewed';
  return judgments.some((judgment) => judgment?.status === 'Fail')
    ? 'Needs changes'
    : 'Meets your checks';
};

const ratingRecord = (
  review: Review,
  candidate: Candidate,
  value: number | null,
  revision?: RatingRevision,
) => {
  if (value === null) return { value: null, state: 'Unrated' as const, revision: undefined };
  const current = revisionFor(review, candidate);
  const state =
    revision?.source === current.source &&
    revision.draft === current.draft &&
    revision.definition === current.definition
      ? ('Current' as const)
      : ('Outdated' as const);
  return { value, state, revision };
};

export function preferenceRatings(review: Review) {
  return review.preferences.map((preference) => ({
    id: preference.id,
    label: preference.label,
    weight: preference.weight,
    a: ratingRecord(review, 0, preference.a, preference.aRevision),
    b: ratingRecord(review, 1, preference.b, preference.bRevision),
  }));
}

const hasMissingDocuments = (review: Review) =>
  !review.documents.source.text.trim() ||
  !review.documents.draftA.text.trim() ||
  !review.documents.draftB.text.trim();

export function decisionFor(review: Review) {
  const candidates = ([0, 1] as Candidate[]).map((candidate) => ({
    candidate,
    state: candidateState(review, candidate),
  }));
  const ratings = preferenceRatings(review);
  const score = weightedEvaluation(
    ratings.map((rating) => ({
      weight: rating.weight,
      a: rating.a.state === 'Current' ? rating.a.value : null,
      b: rating.b.state === 'Current' ? rating.b.value : null,
    })),
  );
  const errors = validationErrors(review);
  const qualified = candidates.filter((candidate) => candidate.state === 'Meets your checks');
  let recommendation: 'A' | 'B' | 'Tie' | null = null;
  let message: string;

  if (hasMissingDocuments(review)) {
    message = 'Add source notes and both drafts, then name the checks each draft must pass.';
  } else if (
    !review.required.length ||
    review.required.some((check) => !check.label.trim()) ||
    !review.preferences.length ||
    review.preferences.some((preference) => !preference.label.trim())
  ) {
    message = 'Name each required check and weighted preference before comparing drafts.';
  } else if (errors.length) {
    message = 'Fix invalid review fields before comparing drafts.';
  } else if (candidates.every((candidate) => candidate.state === 'Needs changes')) {
    message = 'Neither draft meets the required checks. Revise a draft and save fresh reviews.';
  } else if (candidates.some((candidate) => candidate.state === 'Review outdated')) {
    message = 'Re-review the edited material before comparing drafts.';
  } else if (candidates.some((candidate) => candidate.state === 'Unreviewed')) {
    message = 'Save a Pass or Fail review for every required check in both drafts.';
  } else if (
    qualified.length === 1 &&
    candidates.some((candidate) => candidate.state === 'Needs changes')
  ) {
    recommendation = candidateLabel(qualified[0].candidate) as 'A' | 'B';
    message = `Draft ${recommendation} is eligible based on your saved reviews.`;
  } else if (qualified.length === 2 && !score.complete) {
    message = 'Score both eligible drafts from 0 to 5 for every preference before comparing them.';
  } else if (qualified.length === 2 && score.winner === 'Tie') {
    recommendation = 'Tie';
    message = 'Tie — both eligible drafts have equal completed weighted scores.';
  } else if (qualified.length === 2 && (score.winner === 'A' || score.winner === 'B')) {
    recommendation = score.winner;
    message = `Draft ${recommendation} has the higher completed weighted preference score.`;
  } else {
    message = 'Save current reviews before comparing drafts.';
  }

  return { candidates, ratings, score, recommendation, message, errors };
}

export function reviewJson(review: Review) {
  const judgments = review.judgments.map((judgment) => {
    const state = judgmentState(review, judgment);
    return { ...judgment, state, active: state === 'Current' };
  });
  return JSON.stringify(
    {
      version: 2,
      documents: review.documents,
      snapshots: review.snapshots,
      required: review.required,
      requiredRevision: review.requiredRevision,
      preferences: review.preferences,
      preferenceRevision: review.preferenceRevision,
      ratings: preferenceRatings(review),
      judgments,
      errors: validationErrors(review),
      decision: decisionFor(review),
    },
    null,
    2,
  );
}

export function reviewCsv(review: Review) {
  const decision = decisionFor(review);
  const rows: string[][] = [
    ['review field', 'value'],
    ['version', '2'],
    ['source revision', String(review.documents.source.revision)],
    ['draft A revision', String(review.documents.draftA.revision)],
    ['draft B revision', String(review.documents.draftB.revision)],
    ['draft A state', decision.candidates[0].state],
    ['draft B state', decision.candidates[1].state],
    ['recommendation', decision.recommendation ?? 'None'],
    ['decision message', decision.message],
    ['weighted score complete', String(decision.score.complete)],
    ['weighted score A', decision.score.a === null ? '' : String(decision.score.a)],
    ['weighted score B', decision.score.b === null ? '' : String(decision.score.b)],
    [],
    ['document', 'current revision', 'current text'],
    ['source', String(review.documents.source.revision), review.documents.source.text],
    ['draft A', String(review.documents.draftA.revision), review.documents.draftA.text],
    ['draft B', String(review.documents.draftB.revision), review.documents.draftB.text],
    [],
    ['check id', 'check label', 'required revision'],
    ...review.required.map((check) => [check.id, check.label, String(review.requiredRevision)]),
    [],
    [
      'preference id',
      'preference label',
      'weight',
      'candidate',
      'score',
      'rating state',
      'source revision',
      'draft revision',
      'preference revision',
    ],
    ...decision.ratings.flatMap((rating) =>
      ([0, 1] as Candidate[]).map((candidate) => {
        const value = candidate === 0 ? rating.a : rating.b;
        return [
          rating.id,
          rating.label,
          String(rating.weight),
          candidateLabel(candidate),
          value.value === null ? '' : String(value.value),
          value.state,
          value.revision ? String(value.revision.source) : '',
          value.revision ? String(value.revision.draft) : '',
          value.revision ? String(value.revision.definition) : '',
        ];
      }),
    ),
    [],
    [
      'candidate',
      'check id',
      'saved check label',
      'review state',
      'active judgment',
      'result',
      'source revision',
      'source passage',
      'source quote',
      'draft revision',
      'draft passage',
      'draft quote',
      'reason',
    ],
    ...review.judgments.map((judgment) => {
      const state = judgmentState(review, judgment);
      return [
        candidateLabel(judgment.candidate),
        judgment.checkId,
        judgment.checkLabel,
        state,
        String(state === 'Current'),
        judgment.status,
        String(judgment.sourceRevision),
        String(judgment.sourcePassage),
        judgment.sourceText,
        String(judgment.draftRevision),
        String(judgment.draftPassage),
        judgment.draftText,
        judgment.reason,
      ];
    }),
    [],
    ['snapshot document', 'snapshot revision', 'snapshot text'],
    ...review.snapshots.map((item) => [item.key, String(item.revision), item.text]),
    [],
    ['validation error'],
    ...decision.errors.map((error) => [error]),
  ];
  return csvDownload(rows);
}
