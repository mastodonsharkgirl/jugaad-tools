import { useMemo, useRef, useState } from 'react';
import { Download, RotateCcw } from 'lucide-react';
import { csvDownload, formatEvaluationGap, weightedEvaluation } from '@/lib/tools';
type Criterion = {
  id: number;
  label: string;
  weight: number;
  a: number | null;
  b: number | null;
  note: string;
};
const base = (): Criterion[] =>
  ['Useful', 'Accurate', 'Clear'].map((label, id) => ({
    id,
    label,
    weight: 1,
    a: null,
    b: null,
    note: '',
  }));
const parse = (value: string) =>
  value === ''
    ? null
    : Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 5
      ? Number(value)
      : null;
export default function Evals() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [criteria, setCriteria] = useState(base);
  const next = useRef(3);
  const result = useMemo(() => weightedEvaluation(criteria), [criteria]);
  const change = (id: number, patch: Partial<Criterion>) =>
    setCriteria((all) => all.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const reorder = (index: number, direction: number) =>
    setCriteria((all) => {
      const copy = [...all];
      const target = index + direction;
      if (target < 0 || target >= copy.length) return copy;
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          csvDownload([
            ['criterion', 'weight', 'draft A', 'draft B', 'why this score'],
            ...criteria.map((item) => [
              item.label,
              String(item.weight),
              String(item.a ?? ''),
              String(item.b ?? ''),
              item.note,
            ]),
          ]),
        ],
        { type: 'text/csv' },
      ),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'manual-evaluation.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="studio-panel" aria-labelledby="evals-title">
      <header>
        <span className="accent-icon blue">⌘</span>
        <div>
          <p>Put two drafts side by side</p>
          <h1 id="evals-title">Evals for Non-Coders</h1>
          <small>
            Give each draft a score from 0 to 5. Increase the weight for anything that matters more.
            Your drafts stay in this tab and clear when you refresh.
          </small>
        </div>
      </header>
      <div className="response-grid">
        <label>
          Draft A
          <textarea
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder="Optional: paste draft A for reference"
          />
        </label>
        <label>
          Draft B
          <textarea
            value={right}
            onChange={(e) => setRight(e.target.value)}
            placeholder="Optional: paste draft B for reference"
          />
        </label>
      </div>
      <div className="criteria">
        <h2>Your checklist</h2>
        <div className="criterion-head" aria-hidden="true">
          <span>Criterion</span>
          <span>Weight</span>
          <span>Draft A</span>
          <span>Draft B</span>
          <span>Why this score?</span>
          <span />
        </div>
        {criteria.map((item, index) => (
          <div className="criterion-row extended" key={item.id}>
            <span className="mobile-field-label">Criterion</span>
            <input
              aria-label={`Criterion ${index + 1}`}
              value={item.label}
              onChange={(e) => change(item.id, { label: e.target.value })}
            />
            <span className="mobile-field-label">Weight</span>
            <input
              aria-label={`Weight for ${item.label || `criterion ${index + 1}`}`}
              type="number"
              min="0.01"
              max="1000"
              step="0.1"
              value={item.weight}
              onChange={(e) => change(item.id, { weight: Number(e.target.value) })}
            />
            <span className="mobile-field-label">Draft A</span>
            <input
              aria-label={`Rating A for ${item.label || `criterion ${index + 1}`}`}
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={item.a ?? ''}
              onChange={(e) => change(item.id, { a: parse(e.target.value) })}
            />
            <span className="mobile-field-label">Draft B</span>
            <input
              aria-label={`Rating B for ${item.label || `criterion ${index + 1}`}`}
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={item.b ?? ''}
              onChange={(e) => change(item.id, { b: parse(e.target.value) })}
            />
            <span className="mobile-field-label">Why this score?</span>
            <input
              aria-label={`Evidence note for ${item.label || `criterion ${index + 1}`}`}
              value={item.note}
              onChange={(e) => change(item.id, { note: e.target.value })}
              placeholder="Why this score?"
            />
            <span className="row-actions">
              <button
                type="button"
                aria-label={`Move ${item.label} up`}
                onClick={() => reorder(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                aria-label={`Move ${item.label} down`}
                onClick={() => reorder(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                aria-label={`Remove ${item.label}`}
                onClick={() => setCriteria((all) => all.filter((entry) => entry.id !== item.id))}
              >
                ×
              </button>
            </span>
          </div>
        ))}
        <button
          type="button"
          className="quiet-button"
          onClick={() =>
            setCriteria((all) => [
              ...all,
              { id: next.current++, label: 'New criterion', weight: 1, a: null, b: null, note: '' },
            ])
          }
        >
          Add criterion
        </button>
      </div>
      <div className="eval-summary">
        <div>
          {result.complete ? (
            <>
              <strong>Draft A: {result.a?.toFixed(2)} / 5</strong>
              <strong>Draft B: {result.b?.toFixed(2)} / 5</strong>
            </>
          ) : (
            <strong>Incomplete ratings</strong>
          )}
        </div>
        <span>
          {result.complete
            ? result.winner === 'Tie'
              ? 'Your scores are tied.'
              : `By your scores, draft ${result.winner} is ahead by ${formatEvaluationGap(result.gap)}. Scores are rounded to two decimals.`
            : 'Add a score for every row and use a weight above zero to see the comparison.'}
        </span>
        <button className="quiet-button" type="button" onClick={exportCsv}>
          <Download aria-hidden="true" /> Export comparison
        </button>
        <button
          className="quiet-button"
          type="button"
          onClick={() => {
            setLeft('');
            setRight('');
            setCriteria(base());
            next.current = 3;
          }}
        >
          <RotateCcw aria-hidden="true" /> Start over
        </button>
      </div>
    </section>
  );
}
