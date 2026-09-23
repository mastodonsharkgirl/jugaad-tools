import { useMemo, useState } from 'react';
import { Check, Copy, Download, RotateCcw } from 'lucide-react';
import { copyGuidance, type CaseMode, tidyText } from '@/lib/tools';
export default function TextTidy() {
  const [source, setSource] = useState('');
  const [caseMode, setCaseMode] = useState<CaseMode>('none');
  const [dedupe, setDedupe] = useState(true);
  const [trim, setTrim] = useState(true);
  const [removeBlankLines, setBlank] = useState(true);
  const [unicode, setUnicode] = useState(true);
  const [copied, setCopied] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const result = useMemo(
    () => tidyText(source, { caseMode, dedupe, trim, removeBlankLines, unicode }),
    [source, caseMode, dedupe, trim, removeBlankLines, unicode],
  );
  const copy = async () => {
    if (!result.text) return;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unavailable');
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setCopyMessage('Copied to your clipboard.');
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopyMessage(copyGuidance('blocked'));
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([result.text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tidied-text.txt';
    link.click();
    URL.revokeObjectURL(url);
  };
  const reset = () => {
    setSource('');
    setCaseMode('none');
    setDedupe(true);
    setTrim(true);
    setBlank(true);
    setUnicode(true);
    setCopied(false);
    setCopyMessage('');
  };
  return (
    <section className="tool-panel tidy-panel" aria-labelledby="tidy-tool-title">
      <div className="tool-panel-head">
        <div>
          <p className="tool-kicker">make room</p>
          <h1 id="tidy-tool-title">Text Tidy</h1>
          <p>
            Clean copied text locally. The original stays in the left box while you tune each
            operation.
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
          <input type="checkbox" checked={trim} onChange={(e) => setTrim(e.target.checked)} /> Trim
          and collapse spaces
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={removeBlankLines}
            onChange={(e) => setBlank(e.target.checked)}
          />{' '}
          Remove blank lines
        </label>
        <label className="check-label">
          <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} />{' '}
          Remove repeated lines
        </label>
        <label className="check-label">
          <input type="checkbox" checked={unicode} onChange={(e) => setUnicode(e.target.checked)} />{' '}
          Normalise Unicode
        </label>
      </div>
      <div className="tidy-grid">
        <label className="text-box">
          Original source
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
            <button
              className="quiet-button"
              type="button"
              onClick={download}
              disabled={!result.text}
            >
              <Download aria-hidden="true" /> Download
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
        Source: {result.sourceLineCount} lines · {result.sourceCharacterCount} code points. Changes:{' '}
        {result.changes.trimmed} spacing, {result.changes.blanks} blank, {result.changes.duplicates}{' '}
        duplicate, {result.changes.case} case, {result.changes.unicode} Unicode. Duplicate matching
        uses the text after enabled operations, in source order.
      </p>
    </section>
  );
}
