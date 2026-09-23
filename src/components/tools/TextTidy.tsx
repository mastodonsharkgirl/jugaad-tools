import { useMemo, useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import { copyGuidance, type CaseMode, tidyText } from '@/lib/tools';

export default function TextTidy() {
  const [source, setSource] = useState('');
  const [caseMode, setCaseMode] = useState<CaseMode>('none');
  const [dedupe, setDedupe] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const result = useMemo(() => tidyText(source, { caseMode, dedupe }), [source, caseMode, dedupe]);
  const copy = async () => {
    if (!result.text) return;
    if (!navigator.clipboard?.writeText) {
      setCopyMessage(copyGuidance('unavailable'));
      return;
    }
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setCopyMessage('Copied to your clipboard.');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopyMessage(copyGuidance('blocked'));
    }
  };
  const reset = () => {
    setSource('');
    setCaseMode('none');
    setDedupe(true);
    setCopied(false);
    setCopyMessage('');
  };
  return (
    <section className="tool-panel tidy-panel" aria-labelledby="tidy-tool-title">
      <div className="tool-panel-head">
        <div>
          <p className="tool-kicker">02 / make room</p>
          <h1 id="tidy-tool-title">Text Tidy</h1>
          <p>
            Clean pasted text without sending it anywhere. Spaces, blank lines, and repeated lines
            are sorted locally.
          </p>
        </div>
        <span className="tool-stamp">Aa</span>
      </div>
      <div className="tidy-controls">
        <fieldset>
          <legend>Case</legend>
          {(['none', 'lower', 'upper', 'title'] as CaseMode[]).map((mode) => (
            <label key={mode} className="chip">
              <input
                type="radio"
                name="case"
                checked={caseMode === mode}
                onChange={() => setCaseMode(mode)}
              />{' '}
              {mode === 'none' ? 'Keep' : mode}
            </label>
          ))}
        </fieldset>
        <label className="check-label">
          <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />{' '}
          Remove repeated lines
        </label>
      </div>
      <div className="tidy-grid">
        <label className="text-box">
          Paste text
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={'One thought per line\n\nExtra spaces disappear here.'}
          />
        </label>
        <div className="text-box result-box">
          <div className="result-head">
            <span>Clean result</span>
            <span aria-live="polite">
              {result.lineCount} lines · {result.characterCount} code points
            </span>
          </div>
          <pre>{result.text || 'Your cleaned text will appear here.'}</pre>
          <div className="result-actions">
            <button className="primary-button" type="button" onClick={copy} disabled={!result.text}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy result'}
            </button>
            <button className="quiet-button" type="button" onClick={reset}>
              <RotateCcw aria-hidden="true" /> Reset
            </button>
          </div>
          <p className="copy-feedback" aria-live="polite">
            {copyMessage}
          </p>
        </div>
      </div>
      <p className="tool-footnote">
        Unicode text is normalised to a consistent form before duplicates are checked.{' '}
        {result.removedLines
          ? `${result.removedLines} blank or repeated line${result.removedLines > 1 ? 's' : ''} removed.`
          : 'Nothing removed yet.'}
      </p>
    </section>
  );
}
