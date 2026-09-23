import { useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { scoreEvaluation } from '@/lib/tools';

const defaults = ['Useful', 'Accurate', 'Clear'];
type RatingPair = { a: number | null; b: number | null };
type Criterion = { id: number; label: string };
const defaultCriteria = (): Criterion[] => defaults.map((label, id) => ({ id, label }));
const emptyRatings = (): RatingPair[] => defaults.map(() => ({ a: null, b: null }));

function enteredRating(value: string) {
  if (value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 5 ? numeric : null;
}

export default function Evals() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [criteria, setCriteria] = useState<Criterion[]>(defaultCriteria);
  const [ratings, setRatings] = useState<RatingPair[]>(emptyRatings);
  const [notes, setNotes] = useState('');
  const nextCriterionId = useRef(defaults.length);
  const scoreA = useMemo(() => scoreEvaluation(ratings.map((rating) => rating.a)), [ratings]);
  const scoreB = useMemo(() => scoreEvaluation(ratings.map((rating) => rating.b)), [ratings]);

  const updateRating = (index: number, side: keyof RatingPair, value: string) => {
    setRatings((all) =>
      all.map((rating, position) =>
        position === index ? { ...rating, [side]: enteredRating(value) } : rating,
      ),
    );
  };

  return (
    <section className="studio-panel" aria-labelledby="evals-title">
      <header>
        <span className="accent-icon blue">⌘</span>
        <div>
          <p>Manual comparison, no model call</p>
          <h1 id="evals-title">Evals for Non-Coders</h1>
          <small>
            You define the criteria and scores. This page does not judge, send, or store responses.
          </small>
        </div>
      </header>
      <div className="response-grid">
        <label>
          Response A
          <textarea
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder="Paste a response to compare"
          />
        </label>
        <label>
          Response B
          <textarea
            value={right}
            onChange={(e) => setRight(e.target.value)}
            placeholder="Paste another response"
          />
        </label>
      </div>
      <div className="criteria">
        <h2>Your rubric</h2>
        <div className="rating-labels" aria-hidden="true">
          <span />
          <span>Response A</span>
          <span>Response B</span>
        </div>
        {criteria.map((criterion, index) => (
          <div className="criterion-row" key={criterion.id}>
            <input
              aria-label={`Criterion ${index + 1}`}
              value={criterion.label}
              onChange={(e) =>
                setCriteria((all) =>
                  all.map((item, position) =>
                    position === index ? { ...item, label: e.target.value } : item,
                  ),
                )
              }
            />
            <label>
              <span className="sr-only">
                Rating A for {criterion.label || `criterion ${index + 1}`}
              </span>
              <input
                aria-label={`Rating A for ${criterion.label || `criterion ${index + 1}`}`}
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={ratings[index].a ?? ''}
                onChange={(e) => updateRating(index, 'a', e.target.value)}
              />
            </label>
            <label>
              <span className="sr-only">
                Rating B for {criterion.label || `criterion ${index + 1}`}
              </span>
              <input
                aria-label={`Rating B for ${criterion.label || `criterion ${index + 1}`}`}
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={ratings[index].b ?? ''}
                onChange={(e) => updateRating(index, 'b', e.target.value)}
              />
            </label>
          </div>
        ))}
        <button
          type="button"
          className="quiet-button"
          onClick={() => {
            setCriteria((all) => [
              ...all,
              { id: nextCriterionId.current++, label: 'New criterion' },
            ]);
            setRatings((all) => [...all, { a: null, b: null }]);
          }}
        >
          Add criterion
        </button>
      </div>
      <label className="evidence-note">
        Evidence notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why did either response earn its rating?"
        />
      </label>
      <div className="eval-summary">
        <div>
          <strong>Response A: {scoreA === null ? '—' : `${scoreA.toFixed(1)} / 5`}</strong>
          <strong>Response B: {scoreB === null ? '—' : `${scoreB.toFixed(1)} / 5`}</strong>
        </div>
        <span>Average of each response’s entered ratings</span>
        <button
          className="quiet-button"
          type="button"
          onClick={() => {
            setLeft('');
            setRight('');
            setCriteria(defaultCriteria());
            setRatings(emptyRatings());
            setNotes('');
          }}
        >
          <RotateCcw aria-hidden="true" /> Reset evaluation
        </button>
      </div>
    </section>
  );
}
