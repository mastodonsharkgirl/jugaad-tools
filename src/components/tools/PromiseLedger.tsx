import { useMemo, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
type Promise = {
  id: number;
  person: string;
  commitment: string;
  due: string;
  status: 'Open' | 'Done' | 'Waiting';
};
export default function PromiseLedger() {
  const [items, setItems] = useState<Promise[]>([]);
  const [person, setPerson] = useState('');
  const [commitment, setCommitment] = useState('');
  const [due, setDue] = useState('');
  const [filter, setFilter] = useState('All');
  const visible = useMemo(
    () => (filter === 'All' ? items : items.filter((item) => item.status === filter)),
    [items, filter],
  );
  const add = () => {
    if (!person.trim() || !commitment.trim()) return;
    setItems((current) => [
      ...current,
      { id: Date.now(), person: person.trim(), commitment: commitment.trim(), due, status: 'Open' },
    ]);
    setPerson('');
    setCommitment('');
    setDue('');
  };
  return (
    <section className="studio-panel" aria-labelledby="ledger-title">
      <header>
        <span className="accent-icon gold">✓</span>
        <div>
          <p>Commitments, in this tab</p>
          <h1 id="ledger-title">Promise Ledger</h1>
          <small>Nothing is saved, sent, or shared. Refreshing clears this list.</small>
        </div>
      </header>
      <div className="ledger-compose">
        <label>
          Person
          <input
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            placeholder="Who is this for?"
          />
        </label>
        <label>
          Commitment
          <input
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
            placeholder="What will you do?"
          />
        </label>
        <label>
          Due date
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <button className="primary-button" type="button" onClick={add}>
          Add promise
        </button>
      </div>
      <div className="filter-row">
        {['All', 'Open', 'Waiting', 'Done'].map((item) => (
          <button
            key={item}
            type="button"
            className={filter === item ? 'active' : ''}
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
          >
            {item}
          </button>
        ))}
        <button
          className="quiet-button"
          type="button"
          onClick={() => {
            setItems([]);
            setPerson('');
            setCommitment('');
            setDue('');
            setFilter('All');
          }}
        >
          <RotateCcw aria-hidden="true" /> Reset
        </button>
      </div>
      <div className="ledger-list" aria-live="polite">
        {!visible.length ? (
          <p>
            {filter === 'All'
              ? 'No promises here yet.'
              : `No ${filter.toLowerCase()} promises here yet.`}
          </p>
        ) : (
          visible.map((item) => (
            <article key={item.id}>
              <div>
                <b>{item.person}</b>
                <span>{item.commitment}</span>
                <small>{item.due || 'No date set'}</small>
              </div>
              <select
                aria-label={`Status for ${item.person}`}
                value={item.status}
                onChange={(e) =>
                  setItems((all) =>
                    all.map((entry) =>
                      entry.id === item.id
                        ? { ...entry, status: e.target.value as Promise['status'] }
                        : entry,
                    ),
                  )
                }
              >
                <option>Open</option>
                <option>Waiting</option>
                <option>Done</option>
              </select>
              <button
                type="button"
                aria-label={`Delete promise for ${item.person}`}
                onClick={() => setItems((all) => all.filter((entry) => entry.id !== item.id))}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
