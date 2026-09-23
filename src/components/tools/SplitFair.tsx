import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { formatMoney, splitBill } from '@/lib/tools';

export default function SplitFair() {
  const [amount, setAmount] = useState('');
  const [tip, setTip] = useState('0');
  const [people, setPeople] = useState('2');
  const result = useMemo(() => {
    try {
      return amount ? { value: splitBill(amount, tip, Number(people)) } : null;
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Please check the values.' };
    }
  }, [amount, tip, people]);
  const split = result && 'value' in result ? result.value : null;
  const reset = () => {
    setAmount('');
    setTip('0');
    setPeople('2');
  };
  return (
    <section className="tool-panel split-panel" aria-labelledby="split-tool-title">
      <div className="tool-panel-head">
        <div>
          <p className="tool-kicker">01 / divide kindly</p>
          <h1 id="split-tool-title">Split Fair</h1>
          <p>
            Divide a bill to the cent. The first people get one extra paisa when it cannot divide
            evenly.
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
              aria-describedby="split-note"
            />
          </label>
          <label>
            Tip <span>%</span>
            <input inputMode="decimal" value={tip} onChange={(e) => setTip(e.target.value)} />
          </label>
          <label>
            People{' '}
            <input
              inputMode="numeric"
              min="1"
              max="100"
              value={people}
              onChange={(e) => setPeople(e.target.value)}
            />
          </label>
          <p id="split-note" className="field-note">
            No data leaves this page. Enter up to ₹10,000,000.
          </p>
          <button className="quiet-button" type="button" onClick={reset}>
            <RotateCcw aria-hidden="true" /> Reset values
          </button>
        </form>
        <output className="tool-output" aria-live="polite">
          {!result ? (
            <div className="empty-state">
              <strong>Start with the bill total.</strong>
              <span>Your fair split will appear here.</span>
            </div>
          ) : 'error' in result ? (
            <div className="error-state">
              <strong>Check that number</strong>
              <span>{result.error}</span>
            </div>
          ) : (
            split && (
              <>
                <p className="output-label">Total including tip</p>
                <strong className="money-total">{formatMoney(split.totalCents)}</strong>
                <p className="output-detail">
                  Tip: {formatMoney(split.tipCents)} · {split.shares.length} people
                </p>
                <ol className="share-list">
                  {split.shares.map((share, index) => (
                    <li key={index}>
                      <span>Person {index + 1}</span>
                      <strong>{formatMoney(share)}</strong>
                      {index < split.remainder && <small>+ ₹0.01 fairness penny</small>}
                    </li>
                  ))}
                </ol>
                <p className="fairness-note">
                  The amounts add up exactly.{' '}
                  {split.remainder
                    ? `${split.remainder} person${split.remainder > 1 ? 's' : ''} carry the extra paisa.`
                    : 'Everyone pays the same.'}
                </p>
              </>
            )
          )}
        </output>
      </div>
    </section>
  );
}
