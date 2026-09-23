import { useMemo, useRef, useState } from 'react';
import { Copy, Download, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { copyGuidance, csvDownload, validateLedgerEntry } from '@/lib/tools';
type Entry = {
  id: number;
  person: string;
  commitment: string;
  due: string;
  status: 'Open' | 'Done' | 'Waiting';
};
const today = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};
function download(body: string) {
  const url = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'promise-ledger.csv';
  link.click();
  URL.revokeObjectURL(url);
}
export default function PromiseLedger() {
  const [items, setItems] = useState<Entry[]>([]);
  const [person, setPerson] = useState('');
  const [commitment, setCommitment] = useState('');
  const [due, setDue] = useState('');
  const [filter, setFilter] = useState('All');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const personRef = useRef<HTMLInputElement>(null);
  const commitmentRef = useRef<HTMLInputElement>(null);
  const grouped = useMemo(() => {
    const visible = filter === 'All' ? items : items.filter((item) => item.status === filter);
    const order = (item: Entry) => item.due || '9999-12-31';
    const buckets = {
      Overdue: [] as Entry[],
      Today: [] as Entry[],
      Upcoming: [] as Entry[],
      'No date': [] as Entry[],
    };
    visible
      .sort((a, b) => order(a).localeCompare(order(b)))
      .forEach((item) => {
        const bucket = !item.due
          ? 'No date'
          : item.due < today()
            ? 'Overdue'
            : item.due === today()
              ? 'Today'
              : 'Upcoming';
        buckets[bucket].push(item);
      });
    return buckets;
  }, [items, filter]);
  const submit = () => {
    const nextErrors = validateLedgerEntry({ person, commitment, due });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      if (nextErrors.person) personRef.current?.focus();
      else commitmentRef.current?.focus();
      return;
    }
    if (editing !== null)
      setItems((all) =>
        all.map((item) =>
          item.id === editing
            ? { ...item, person: person.trim(), commitment: commitment.trim(), due }
            : item,
        ),
      );
    else
      setItems((all) => [
        ...all,
        {
          id: Date.now(),
          person: person.trim(),
          commitment: commitment.trim(),
          due,
          status: 'Open',
        },
      ]);
    setPerson('');
    setCommitment('');
    setDue('');
    setEditing(null);
  };
  const summary = items
    .map(
      (item) =>
        `${item.person}: ${item.commitment}${item.due ? ` (due ${item.due})` : ''} — ${item.status}`,
    )
    .join('\n');
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unavailable');
      await navigator.clipboard.writeText(summary);
    } catch {
      alert(copyGuidance('blocked'));
    }
  };
  const reset = () => {
    setItems([]);
    setPerson('');
    setCommitment('');
    setDue('');
    setFilter('All');
    setErrors({});
    setEditing(null);
  };
  return (
    <section className="studio-panel" aria-labelledby="ledger-title">
      <header>
        <span className="accent-icon gold">✓</span>
        <div>
          <p>A short list for the things you said you would do</p>
          <h1 id="ledger-title">Promise Ledger</h1>
          <small>
            This list stays in this tab. Refreshing clears it, so copy or download it if you need it
            later.
          </small>
        </div>
      </header>
      <div className="ledger-compose">
        <label>
          Person
          <input
            ref={personRef}
            value={person}
            aria-invalid={!!errors.person}
            aria-describedby={errors.person ? 'person-error' : undefined}
            onChange={(e) => setPerson(e.target.value)}
          />
          {errors.person && (
            <small id="person-error" className="error-state">
              {errors.person}
            </small>
          )}
        </label>
        <label>
          Commitment
          <input
            ref={commitmentRef}
            value={commitment}
            aria-invalid={!!errors.commitment}
            onChange={(e) => setCommitment(e.target.value)}
          />
          {errors.commitment && <small className="error-state">{errors.commitment}</small>}
        </label>
        <label>
          Due date
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </label>
        <button className="primary-button" type="button" onClick={submit}>
          {editing !== null ? 'Save change' : 'Add to list'}
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
            {item} (
            {item === 'All' ? items.length : items.filter((entry) => entry.status === item).length})
          </button>
        ))}
        <button className="quiet-button" type="button" disabled={!items.length} onClick={copy}>
          <Copy aria-hidden="true" /> Copy summary
        </button>
        <button
          className="quiet-button"
          type="button"
          disabled={!items.length}
          onClick={() =>
            download(
              csvDownload([
                ['person', 'commitment', 'due', 'status'],
                ...items.map((entry) => [entry.person, entry.commitment, entry.due, entry.status]),
              ]),
            )
          }
        >
          <Download aria-hidden="true" /> Download
        </button>
        <button className="quiet-button" type="button" onClick={reset}>
          <RotateCcw aria-hidden="true" /> Reset all
        </button>
      </div>
      <div className="ledger-list" aria-live="polite">
        {Object.entries(grouped).map(([heading, entries]) =>
          entries.length ? (
            <section key={heading}>
              <h2>
                {heading} <span>{entries.length}</span>
              </h2>
              {entries.map((item) => (
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
                            ? { ...entry, status: e.target.value as Entry['status'] }
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
                    aria-label={`Edit promise for ${item.person}`}
                    onClick={() => {
                      setPerson(item.person);
                      setCommitment(item.commitment);
                      setDue(item.due);
                      setEditing(item.id);
                    }}
                  >
                    <Pencil aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete promise for ${item.person}`}
                    onClick={() => setItems((all) => all.filter((entry) => entry.id !== item.id))}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </article>
              ))}
            </section>
          ) : null,
        )}
        {!items.length && <p>Your list is empty.</p>}
      </div>
    </section>
  );
}
