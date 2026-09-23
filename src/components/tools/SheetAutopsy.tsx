import { useMemo, useState } from 'react';
import { RotateCcw, Upload } from 'lucide-react';
import { inspectCsv } from '@/lib/tools';

const LIMIT = 600_000;
export default function SheetAutopsy() {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const report = useMemo(() => (text ? inspectCsv(text) : null), [text]);
  const loadFile = (file?: File) => {
    if (!file) return;
    if (file.size > LIMIT) {
      setError('Choose a CSV smaller than 600 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ''));
      setError('');
    };
    reader.readAsText(file);
  };
  return (
    <section className="studio-panel" aria-labelledby="sheet-title">
      <header>
        <span className="accent-icon teal">⌁</span>
        <div>
          <p>Inspect a CSV, locally</p>
          <h1 id="sheet-title">Sheet Autopsy</h1>
          <small>
            Reads plain text only. Files are never uploaded to a server or run as formulas.
          </small>
        </div>
      </header>
      <div className="studio-grid">
        <div>
          <label className="drop-zone">
            Paste CSV text
            <textarea
              value={text}
              onChange={(event) => {
                if (event.target.value.length > LIMIT) {
                  setError('Paste a CSV smaller than 600 KB. Nothing beyond the limit was read.');
                  return;
                }
                setText(event.target.value);
                setError('');
              }}
              placeholder={'name,owner,status\nExample,Sam,open'}
            />
          </label>
          <label className="file-button">
            <Upload aria-hidden="true" /> Choose CSV
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => loadFile(event.target.files?.[0])}
            />
          </label>
          <button
            className="quiet-button"
            type="button"
            onClick={() => {
              setText('');
              setError('');
            }}
          >
            <RotateCcw aria-hidden="true" /> Reset
          </button>
          {error && (
            <p className="error-state" role="alert">
              {error}
            </p>
          )}
        </div>
        <output className="analysis-output" aria-live="polite">
          {!report ? (
            <p>Paste a small CSV to see its structure and quality checks.</p>
          ) : (
            <>
              <div className="metric-row">
                <b>{report.dataRows}</b>
                <span>data rows</span>
                <b>{report.headers.length}</b>
                <span>columns</span>
              </div>
              <ul>
                <li>{report.missingCells} missing cells</li>
                <li>{report.duplicateRows} repeated rows</li>
                <li>{report.raggedRows} uneven rows</li>
                <li>{report.formulaLikeCells} formula-like values left as text</li>
              </ul>
              {report.parseError && <p className="error-state">{report.parseError}</p>}
              <p>
                {report.raggedRows
                  ? 'Fix uneven rows before importing.'
                  : 'Row widths match the header.'}
              </p>
            </>
          )}
        </output>
      </div>
    </section>
  );
}
