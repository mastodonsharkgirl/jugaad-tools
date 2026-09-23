import { useMemo, useState } from 'react';
import { Copy, RotateCcw } from 'lucide-react';
import { copyGuidance, formatMoney, splitWeightedBill } from '@/lib/tools';
type Person = { name: string; weight: string };
export default function SplitFair() {
  const [amount, setAmount] = useState('');
  const [tip, setTip] = useState('0');
  const [people, setPeople] = useState<Person[]>([
    { name: 'Asha', weight: '1' },
    { name: 'Dev', weight: '1' },
  ]);
  const result = useMemo(() => {
    try {
      return amount ? { value: splitWeightedBill(amount, tip, people) } : null;
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Check the values.' };
    }
  }, [amount, tip, people]);
  const reset = () => {
    setAmount('');
    setTip('0');
    setPeople([
      { name: 'Asha', weight: '1' },
      { name: 'Dev', weight: '1' },
    ]);
  };
  const update = (index: number, patch: Partial<Person>) =>
    setPeople((all) => all.map((person, i) => (i === index ? { ...person, ...patch } : person)));
  const copy = async () => {
    if (!result || !('value' in result) || !result.value) return;
    const text = result.value.shares
      .map((share) => `${share.name}: ${formatMoney(share.cents)}`)
      .join('\n');
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(text);
    } catch {
      alert(copyGuidance('blocked'));
    }
  };
  return (
    <section className="tool-panel split-panel" aria-labelledby="split-tool-title">
      <div className="tool-panel-head">
        <div>
          <p className="tool-kicker">divide clearly</p>
          <h1 id="split-tool-title">Split Fair</h1>
          <p>
            Name people and adjust their shares. Integer paisa arithmetic keeps the final sum exact.
          </p>
        </div>
        <span className="tool-stamp">₹</span>
      </div>
      <div className="tool-grid">
        <form className="tool-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            Bill total <span>INR</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1249.50"
            />
          </label>
          <label>
            Tip <span>%</span>
            <input inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} />
          </label>
          <fieldset className="people-editor">
            <legend>People and share weights</legend>
            {people.map((person, index) => (
              <div key={index}>
                <input
                  aria-label={`Name for person ${index + 1}`}
                  value={person.name}
                  onChange={(e) => update(index, { name: e.target.value })}
                />
                <input
                  aria-label={`Weight for ${person.name || `person ${index + 1}`}`}
                  inputMode="decimal"
                  value={person.weight}
                  onChange={(e) => update(index, { weight: e.target.value })}
                />
                <button
                  type="button"
                  aria-label={`Remove ${person.name || `person ${index + 1}`}`}
                  disabled={people.length === 1}
                  onClick={() => setPeople((all) => all.filter((_, i) => i !== index))}
                >
                  ×
                </button>
              </div>
            ))}
          </fieldset>
          <button
            className="quiet-button"
            type="button"
            disabled={people.length >= 100}
            onClick={() => setPeople((all) => [...all, { name: '', weight: '1' }])}
          >
            Add person
          </button>
          <button className="quiet-button" type="button" onClick={reset}>
            <RotateCcw aria-hidden="true" /> Reset values
          </button>
        </form>
        <output className="tool-output" aria-live="polite">
          {!result ? (
            <div className="empty-state">
              <strong>Start with the bill total.</strong>
              <span>Your exact local split will appear here.</span>
            </div>
          ) : 'error' in result ? (
            <div className="error-state">
              <strong>Check that number</strong>
              <span>{result.error}</span>
            </div>
          ) : (
            <>
              <p className="output-label">Total including tip</p>
              <strong className="money-total">{formatMoney(result.value.totalCents)}</strong>
              <p className="output-detail">
                Tip: {formatMoney(result.value.tipCents)} · weights can be unequal
              </p>
              <ol className="share-list">
                {result.value.shares.map((share) => (
                  <li key={share.name}>
                    <span>
                      {share.name} <small>×{share.weight}</small>
                    </span>
                    <strong>{formatMoney(share.cents)}</strong>
                  </li>
                ))}
              </ol>
              <p className="fairness-note">
                Reconciled:{' '}
                {formatMoney(result.value.shares.reduce((sum, share) => sum + share.cents, 0))} ={' '}
                {formatMoney(result.value.totalCents)}.
              </p>
              <button className="quiet-button" type="button" onClick={copy}>
                <Copy aria-hidden="true" /> Copy summary
              </button>
            </>
          )}
        </output>
      </div>
    </section>
  );
}
