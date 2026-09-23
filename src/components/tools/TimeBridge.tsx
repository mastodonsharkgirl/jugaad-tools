import { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { formatInZone, zonedDateTimeToUtc } from '@/lib/tools';

const zones = [
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];
export default function TimeBridge() {
  const [dateTime, setDateTime] = useState('');
  const [source, setSource] = useState('Asia/Kolkata');
  const [target, setTarget] = useState('America/New_York');
  const result = useMemo(() => {
    try {
      return dateTime ? { value: zonedDateTimeToUtc(dateTime, source) } : null;
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Choose a valid time.' };
    }
  }, [dateTime, source]);
  const bridge = result && 'value' in result ? result.value : null;
  return (
    <section className="tool-panel time-panel" aria-labelledby="time-tool-title">
      <div className="tool-panel-head">
        <div>
          <p className="tool-kicker">03 / cross the clock</p>
          <h1 id="time-tool-title">Time Bridge</h1>
          <p>
            Plan a meeting across time zones. Time-zone rules come from your browser;
            daylight-saving changes are reflected in the conversion.
          </p>
        </div>
        <span className="tool-stamp">↔</span>
      </div>
      <div className="time-grid">
        <div className="time-form">
          <label>
            Date and time
            <input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
          </label>
          <label>
            From
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {zones.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </label>
          <label>
            To
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {zones.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </label>
          <button
            className="quiet-button"
            type="button"
            onClick={() => {
              setDateTime('');
              setSource('Asia/Kolkata');
              setTarget('America/New_York');
            }}
          >
            <RotateCcw aria-hidden="true" /> Reset planner
          </button>
        </div>
        <output className="time-result" aria-live="polite">
          {!result ? (
            <div className="empty-state">
              <strong>Choose a meeting time.</strong>
              <span>We will carry it across the bridge.</span>
            </div>
          ) : 'error' in result ? (
            <div className="error-state">
              <strong>That time needs a second look.</strong>
              <span>{result.error}</span>
            </div>
          ) : (
            bridge && (
              <>
                <p className="output-label">At your destination</p>
                <strong>{formatInZone(bridge.utc, target)}</strong>
                <p>Source: {formatInZone(bridge.utc, source)}</p>
                {bridge.ambiguous && (
                  <p className="dst-note">
                    This time occurs twice at a daylight-saving change. We show the earlier
                    occurrence.
                  </p>
                )}
                <p className="tool-footnote">No calendar is connected and no meeting is created.</p>
              </>
            )
          )}
        </output>
      </div>
    </section>
  );
}
