import { Download, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  addPreference,
  addRequired,
  captureJudgment,
  createReview,
  decisionFor,
  judgmentState,
  numberedPassages,
  ratePreference,
  removePreference,
  removeRequired,
  resetReview,
  reviewCsv,
  reviewJson,
  updateDocument,
  updatePreferences,
  updateRequired,
  type Candidate,
  type DocumentKey,
  type JudgmentStatus,
  type JudgmentState,
  type RequiredJudgment,
  type Review,
} from '@/lib/evidence-review';

type Composer = {
  candidate: Candidate;
  check: number;
  sourcePassage: number;
  draftPassage: number;
  status: JudgmentStatus;
  reason: string;
};

const example = () =>
  createReview({
    source: 'The workshop has not measured outcomes.\nShare what is confirmed today.',
    drafts: [
      'Our workshop guarantees a better outcome for every team.',
      'We will share the current workshop status and next confirmed step.',
    ],
    required: ['Avoid unsupported promises'],
    preferences: [{ label: 'Clear and direct', weight: 1, a: null, b: null }],
  });

const freshComposer = (candidate: Candidate = 0, check = 0): Composer => ({
  candidate,
  check,
  sourcePassage: 1,
  draftPassage: 1,
  status: 'Pass',
  reason: '',
});

const download = (name: string, content: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
};

const documentTitle = (key: DocumentKey) =>
  key === 'source' ? 'Source notes' : key === 'draftA' ? 'Draft A' : 'Draft B';
const documentCitationName = (key: DocumentKey) =>
  key === 'source' ? 'source' : documentTitle(key);
const passageId = (key: DocumentKey, revision: number, passage: number) =>
  `evidence-${key}-r${revision}-p${passage}`;

export default function Evals() {
  const [review, setReview] = useState<Review>(() => resetReview());
  const [selection, setSelection] = useState<Composer>(() => freshComposer());
  const [highlight, setHighlight] = useState<{ key: DocumentKey; passage: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const decision = useMemo(() => decisionFor(review), [review]);
  const selectedDraftKey: DocumentKey = selection.candidate === 0 ? 'draftA' : 'draftB';
  const selectedSource = numberedPassages(review.documents.source.text).find(
    (item) => item.passage === selection.sourcePassage,
  );
  const selectedDraft = numberedPassages(review.documents[selectedDraftKey].text).find(
    (item) => item.passage === selection.draftPassage,
  );
  const selectedState = decision.candidates.find(
    (candidate) => candidate.candidate === selection.candidate,
  )?.state;
  const hasWorkspaceContent = Object.values(review.documents).some((document) =>
    document.text.trim(),
  );

  const clearComposer = (candidate = selection.candidate, check = selection.check) => {
    setSelection(
      freshComposer(candidate, Math.min(Math.max(check, 0), review.required.length - 1)),
    );
    setFormError(null);
  };

  const reset = (next: Review) => {
    setReview(next);
    setSelection(freshComposer());
    setHighlight(null);
    setFormError(null);
  };

  const updateText = (key: DocumentKey, text: string) => {
    setReview((current) => updateDocument(current, key, text));
    clearComposer();
    setHighlight(null);
  };

  const saveReview = () => {
    const next = captureJudgment(review, selection);
    setReview(next);
    if (next.judgments.length === review.judgments.length) {
      setFormError(next.errors[0] ?? 'Review this evidence before saving it.');
      return;
    }
    clearComposer(selection.candidate, selection.check);
  };

  const focusPassage = (key: DocumentKey, revision: number, passage: number) => {
    if (review.documents[key].revision !== revision) return;
    setHighlight({ key, passage });
    const target = document.getElementById(passageId(key, revision, passage));
    if (!(target instanceof HTMLElement)) return;
    target.scrollIntoView({ block: 'center' });
    target.focus();
  };

  const reviewAgain = (judgment: RequiredJudgment) => {
    const check = review.required.findIndex((item) => item.id === judgment.checkId);
    if (check < 0) return;
    clearComposer(judgment.candidate, check);
    setHighlight(null);
    document.getElementById('evidence-composer')?.scrollIntoView({ block: 'center' });
  };

  const renderPassageRail = (key: DocumentKey) => {
    const revision = review.documents[key].revision;
    const items = numberedPassages(review.documents[key].text);
    const title = documentTitle(key);
    const citationName = key === 'source' ? 'Source' : documentCitationName(key);
    return (
      <section className="evidence-passage-rail" aria-labelledby={`${key}-passages-title`}>
        <h2 id={`${key}-passages-title`}>
          {title} — revision {revision}
        </h2>
        {items.length === 0 ? (
          <p className="evidence-empty">Add text above to create numbered passages.</p>
        ) : (
          <ol>
            {items.map((item) => {
              const highlighted = highlight?.key === key && highlight.passage === item.passage;
              return (
                <li key={item.passage}>
                  <button
                    className={highlighted ? 'evidence-passage is-highlighted' : 'evidence-passage'}
                    data-highlighted={highlighted ? 'true' : 'false'}
                    id={passageId(key, revision, item.passage)}
                    type="button"
                    onClick={() => focusPassage(key, revision, item.passage)}
                    aria-label={`${citationName} passage ${item.passage}, revision ${revision}`}
                  >
                    <span aria-hidden="true">{item.passage}</span>
                    <span>{item.text}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    );
  };

  const renderSelectedQuote = (
    label: 'source' | 'draft',
    key: DocumentKey,
    passage: number,
    text: string | undefined,
  ) => (
    <blockquote className="selected-evidence" role="note" aria-label={`Selected ${label} passage`}>
      <strong>
        {label === 'source' ? 'Source' : documentTitle(key)} r{review.documents[key].revision} ·
        passage {passage}
      </strong>
      <span>
        {text ?? `Add ${label === 'source' ? 'source notes' : 'this draft'} to select a passage.`}
      </span>
    </blockquote>
  );

  const renderCitation = (
    label: 'source' | 'draft',
    key: DocumentKey,
    revision: number,
    passage: number,
    state: JudgmentState,
  ) => {
    const citationName = label === 'source' ? 'source' : documentTitle(key);
    const visible = `${label === 'source' ? 'Source' : documentTitle(key)} r${revision} · passage ${passage}`;
    if (state !== 'Current') {
      return (
        <span className={state === 'Superseded' ? 'superseded-citation' : 'stale-citation'}>
          {visible} · {state === 'Superseded' ? 'superseded quote' : 'retained quote'}
        </span>
      );
    }
    return (
      <button
        className="evidence-citation"
        type="button"
        onClick={() => focusPassage(key, revision, passage)}
        aria-label={`Open ${citationName} passage ${passage} from revision ${revision}`}
      >
        {visible}
      </button>
    );
  };

  const renderSavedReviews = (candidate: Candidate) => {
    const judgments = review.judgments.filter((judgment) => judgment.candidate === candidate);
    const title = `Draft ${candidate === 0 ? 'A' : 'B'} saved reviews`;
    const draftKey = candidate === 0 ? 'draftA' : 'draftB';
    return (
      <section className="saved-draft-reviews" aria-labelledby={`saved-reviews-${candidate}`}>
        <h3 id={`saved-reviews-${candidate}`}>{title}</h3>
        {judgments.length === 0 ? (
          <p className="evidence-empty">No saved reviews for this draft yet.</p>
        ) : (
          judgments.map((judgment, index) => {
            const state = judgmentState(review, judgment);
            const current = state === 'Current';
            const checkStillExists = review.required.some((check) => check.id === judgment.checkId);
            const reviewStatus =
              state === 'Current'
                ? 'Current review'
                : state === 'Superseded'
                  ? 'Superseded review'
                  : 'Review outdated';
            return (
              <article
                className={
                  current
                    ? 'evidence-card'
                    : state === 'Superseded'
                      ? 'evidence-card superseded'
                      : 'evidence-card outdated'
                }
                key={`${judgment.checkId}-${judgment.requiredRevision}-${index}`}
              >
                <p className="evidence-card-title">
                  <strong>
                    Draft {candidate === 0 ? 'A' : 'B'} · {judgment.checkLabel} · {judgment.status}
                  </strong>
                </p>
                <p>
                  {reviewStatus} · source r{judgment.sourceRevision}, draft r
                  {judgment.draftRevision}, checks r{judgment.requiredRevision}
                </p>
                <div className="evidence-card-citations">
                  {renderCitation(
                    'source',
                    'source',
                    judgment.sourceRevision,
                    judgment.sourcePassage,
                    state,
                  )}
                  {renderCitation(
                    'draft',
                    draftKey,
                    judgment.draftRevision,
                    judgment.draftPassage,
                    state,
                  )}
                </div>
                <blockquote>
                  <strong>Source quote:</strong> {judgment.sourceText}
                </blockquote>
                <blockquote>
                  <strong>Draft quote:</strong> {judgment.draftText}
                </blockquote>
                <p>
                  <strong>Reason:</strong> {judgment.reason}
                </p>
                {state === 'Outdated' && checkStillExists && (
                  <button
                    className="quiet-button"
                    type="button"
                    onClick={() => reviewAgain(judgment)}
                    aria-label={`Review Draft ${candidate === 0 ? 'A' : 'B'} check ${judgment.checkLabel} again`}
                  >
                    Review again
                  </button>
                )}
              </article>
            );
          })
        )}
      </section>
    );
  };

  return (
    <section className="studio-panel evidence-review" aria-labelledby="evals-title">
      <header>
        <span className="accent-icon blue">⌘</span>
        <div>
          <p>Manual evidence review</p>
          <h1 id="evals-title">Choose a draft. Keep the reason.</h1>
          <small>
            Compare two drafts against your notes and requirements. You make the judgments; this
            tool keeps them attached to the text you reviewed.
          </small>
        </div>
      </header>
      <div className="evidence-actions">
        <button className="quiet-button" type="button" onClick={() => reset(example())}>
          Load fictional workshop example
        </button>
        <button className="quiet-button" type="button" onClick={() => reset(resetReview())}>
          Start blank
        </button>
      </div>
      {!hasWorkspaceContent && (
        <p className="evidence-guidance">
          Add your notes and both drafts, then name a check each draft must pass. Or load the
          fictional workshop example to see the flow.
        </p>
      )}
      <div className="evidence-editors">
        <label>
          Source notes
          <textarea
            aria-label="Source notes"
            value={review.documents.source.text}
            onChange={(event) => updateText('source', event.target.value)}
            placeholder="Paste source notes you can cite."
          />
        </label>
        <label>
          Draft A
          <textarea
            aria-label="Draft A"
            value={review.documents.draftA.text}
            onChange={(event) => updateText('draftA', event.target.value)}
            placeholder="Paste draft A."
          />
        </label>
        <label>
          Draft B
          <textarea
            aria-label="Draft B"
            value={review.documents.draftB.text}
            onChange={(event) => updateText('draftB', event.target.value)}
            placeholder="Paste draft B."
          />
        </label>
      </div>
      {hasWorkspaceContent && decision.errors.length > 0 && (
        <section className="evidence-validation" aria-label="Review validation">
          <strong>Fix these review fields before comparing drafts:</strong>
          <ul>
            {decision.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </section>
      )}
      <div className="evidence-passages-grid">
        {renderPassageRail('source')}
        {renderPassageRail('draftA')}
        {renderPassageRail('draftB')}
      </div>
      <div className="evidence-grid">
        <div className="evidence-section">
          <h2>Required checks</h2>
          {review.required.map((check, index) => (
            <div className="criterion-row" key={check.id}>
              <label>
                Check {index + 1}
                <input
                  aria-label={`Required check ${index + 1}`}
                  value={check.label}
                  maxLength={120}
                  placeholder="For example: Supported by the notes"
                  onChange={(event) => {
                    setReview((current) =>
                      updateRequired(
                        current,
                        current.required.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, label: event.target.value } : item,
                        ),
                      ),
                    );
                    clearComposer();
                  }}
                />
              </label>
              <button
                className="quiet-button compact-button"
                type="button"
                disabled={review.required.length <= 1}
                onClick={() => {
                  setReview((current) => removeRequired(current, check.id));
                  setSelection(freshComposer(selection.candidate));
                  setFormError(null);
                  setHighlight(null);
                }}
                aria-label={`Remove required check ${index + 1}`}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            className="quiet-button"
            type="button"
            disabled={review.required.length >= 8}
            onClick={() => {
              setReview((current) => addRequired(current, 'New required check'));
              setSelection(freshComposer(selection.candidate));
              setFormError(null);
              setHighlight(null);
            }}
          >
            Add required check
          </button>
          <h2>Weighted preferences</h2>
          <p className="preference-hint">
            Score each eligible draft from 0 to 5. Weight sets relative importance; preferences
            never override a failed required check.
          </p>
          {review.preferences.map((preference, index) => {
            const rating = decision.ratings[index];
            return (
              <div className="preference" key={preference.id}>
                <label>
                  Preference
                  <input
                    aria-label={`Preference ${index + 1}`}
                    value={preference.label}
                    maxLength={120}
                    placeholder="For example: Clear and direct"
                    onChange={(event) =>
                      setReview((current) =>
                        updatePreferences(
                          current,
                          current.preferences.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, label: event.target.value } : item,
                          ),
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  Weight
                  <input
                    aria-label={`Weight ${index + 1}`}
                    type="number"
                    min="0.01"
                    max="1000"
                    value={preference.weight}
                    onChange={(event) =>
                      setReview((current) =>
                        updatePreferences(
                          current,
                          current.preferences.map((item, itemIndex) =>
                            itemIndex === index
                              ? { ...item, weight: Number(event.target.value) }
                              : item,
                          ),
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  A score (0–5)
                  <input
                    aria-label={`Draft A score ${index + 1}`}
                    type="number"
                    min="0"
                    max="5"
                    value={preference.a ?? ''}
                    onChange={(event) =>
                      setReview((current) =>
                        ratePreference(
                          current,
                          index,
                          0,
                          event.target.value === '' ? null : Number(event.target.value),
                        ),
                      )
                    }
                  />
                </label>
                <label>
                  B score (0–5)
                  <input
                    aria-label={`Draft B score ${index + 1}`}
                    type="number"
                    min="0"
                    max="5"
                    value={preference.b ?? ''}
                    onChange={(event) =>
                      setReview((current) =>
                        ratePreference(
                          current,
                          index,
                          1,
                          event.target.value === '' ? null : Number(event.target.value),
                        ),
                      )
                    }
                  />
                </label>
                <button
                  className="quiet-button compact-button"
                  type="button"
                  disabled={review.preferences.length <= 1}
                  onClick={() => setReview((current) => removePreference(current, preference.id))}
                  aria-label={`Remove preference ${index + 1}`}
                >
                  Remove
                </button>
                {(rating?.a.state === 'Outdated' || rating?.b.state === 'Outdated') && (
                  <p className="rating-stale">
                    {rating.a.state === 'Outdated' &&
                      `Draft A score ${rating.a.value} is outdated. `}
                    {rating.b.state === 'Outdated' &&
                      `Draft B score ${rating.b.value} is outdated. `}
                    Re-rate after reviewing the current text.
                  </p>
                )}
              </div>
            );
          })}
          <button
            className="quiet-button"
            type="button"
            disabled={review.preferences.length >= 8}
            onClick={() => setReview((current) => addPreference(current, 'New preference'))}
          >
            Add preference
          </button>
        </div>
        <div className="evidence-section evidence-composer" id="evidence-composer">
          <h2>Save a required review</h2>
          {selectedState === 'Review outdated' && (
            <p className="evidence-stale">
              Draft {selection.candidate === 0 ? 'A' : 'B'} has outdated saved evidence. Choose
              current passages and save a fresh review.
            </p>
          )}
          <label>
            Draft
            <select
              aria-label="Review draft"
              value={selection.candidate}
              onChange={(event) => clearComposer(Number(event.target.value) as Candidate)}
            >
              <option value={0}>Draft A</option>
              <option value={1}>Draft B</option>
            </select>
          </label>
          <label>
            Required check
            <select
              aria-label="Review check"
              value={selection.check}
              onChange={(event) => clearComposer(selection.candidate, Number(event.target.value))}
            >
              {review.required.map((check, index) => (
                <option value={index} key={check.id}>
                  {check.label || 'Unnamed check'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Result
            <select
              aria-label="Required result"
              value={selection.status}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  status: event.target.value as JudgmentStatus,
                }))
              }
            >
              <option>Pass</option>
              <option>Fail</option>
            </select>
          </label>
          <label>
            Source passage
            <select
              aria-label="Source passage"
              value={selection.sourcePassage}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  sourcePassage: Number(event.target.value),
                }))
              }
            >
              {numberedPassages(review.documents.source.text).map((item) => (
                <option value={item.passage} key={item.passage}>
                  {item.passage}. {item.text}
                </option>
              ))}
            </select>
          </label>
          {renderSelectedQuote('source', 'source', selection.sourcePassage, selectedSource?.text)}
          <label>
            Draft passage
            <select
              aria-label="Draft passage"
              value={selection.draftPassage}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  draftPassage: Number(event.target.value),
                }))
              }
            >
              {numberedPassages(review.documents[selectedDraftKey].text).map((item) => (
                <option value={item.passage} key={item.passage}>
                  {item.passage}. {item.text}
                </option>
              ))}
            </select>
          </label>
          {renderSelectedQuote(
            'draft',
            selectedDraftKey,
            selection.draftPassage,
            selectedDraft?.text,
          )}
          <label>
            Reason
            <textarea
              aria-label="Review reason"
              maxLength={1000}
              value={selection.reason}
              onChange={(event) =>
                setSelection((current) => ({ ...current, reason: event.target.value }))
              }
            />
          </label>
          <button className="primary-button" type="button" onClick={saveReview}>
            Save review for Draft {selection.candidate === 0 ? 'A' : 'B'}
          </button>
          {formError && (
            <p className="evidence-error" role="alert">
              {formError}
            </p>
          )}
        </div>
      </div>
      <section className="evidence-cards" aria-label="Saved review evidence">
        <h2>Saved review evidence</h2>
        {review.judgments.length === 0 ? (
          <p>Saved reasons and citations will appear here.</p>
        ) : (
          <div className="saved-reviews-grid">
            {renderSavedReviews(0)}
            {renderSavedReviews(1)}
          </div>
        )}
      </section>
      <div className="decision-strip" aria-live="polite">
        <div className="decision-summary">
          {decision.candidates.map((candidate) => (
            <p key={candidate.candidate}>
              <strong>Draft {candidate.candidate === 0 ? 'A' : 'B'}:</strong> {candidate.state}
            </p>
          ))}
          <p>
            <strong>Decision:</strong> {decision.message}
          </p>
          <p className="preference-result">
            Weighted preferences compare only drafts that meet required checks.
            {decision.score.complete && (
              <>
                {' '}
                Draft A: {decision.score.a}/5 · Draft B: {decision.score.b}/5.
              </>
            )}
          </p>
        </div>
        <div className="decision-actions" aria-label="Evidence review downloads and reset">
          <button
            className="quiet-button"
            type="button"
            onClick={() => download('evidence-review.json', reviewJson(review), 'application/json')}
          >
            <Download aria-hidden="true" /> Download JSON
          </button>
          <button
            className="quiet-button"
            type="button"
            onClick={() => download('evidence-review.csv', reviewCsv(review), 'text/csv')}
          >
            <Download aria-hidden="true" /> Download CSV
          </button>
          <button className="quiet-button" type="button" onClick={() => reset(resetReview())}>
            <RotateCcw aria-hidden="true" /> Reset all
          </button>
        </div>
      </div>
    </section>
  );
}
