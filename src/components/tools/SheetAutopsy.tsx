import { useMemo, useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { analyzeCsv, csvDownload } from '@/lib/tools';
const LIMIT = 600_000;
function download(name: string, body: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export default function SheetAutopsy() {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const report = useMemo(() => (text ? analyzeCsv(text) : null), [text]);
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
          <p>Check a CSV before you import it</p>
          <h1 id="sheet-title">Sheet Autopsy</h1>
          <small>
            Paste text or choose a small file. It stays here, and cells that look like formulas are
            treated as text.
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
                  setError('This is too much text to check at once. Try a smaller section.');
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
            <p>Paste a CSV to see blanks, repeated rows and uneven columns.</p>
          ) : (
            <>
              <div className="metric-row">
                <b>{report.dataRows}</b>
                <span>data rows</span>
                <b>{report.findings.length}</b>
                <span>findings</span>
              </div>
              {report.parseError && (
                <p className="error-state" role="alert">
                  {report.parseError}
                </p>
              )}
              <p>
                Your CSV is left alone. The downloaded report keeps formula-like values as text.
              </p>
              <button
                className="quiet-button"
                type="button"
                onClick={() =>
                  download(
                    'sheet-autopsy-report.csv',
                    csvDownload([
                      ['source row', 'source column', 'source', 'finding', 'safe preview'],
                      ...report.findings.map((f) => [
                        String(f.row || ''),
                        String(f.column || ''),
                        f.source,
                        f.finding,
                        f.preview,
                      ]),
                    ]),
                  )
                }
              >
                <Download aria-hidden="true" /> Download report
              </button>
              <div className="finding-table" role="region" aria-label="CSV findings" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Column</th>
                      <th>Finding</th>
                      <th>Safe preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.findings.length ? (
                      report.findings.map((finding, index) => (
                        <tr key={`${finding.row}-${finding.column}-${index}`}>
                          <td>{finding.row || '—'}</td>
                          <td>{finding.column || '—'}</td>
                          <td>{finding.finding}</td>
                          <td>{finding.preview}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4}>No blank cells, repeated rows or uneven columns found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </output>
      </div>
    </section>
  );
}
