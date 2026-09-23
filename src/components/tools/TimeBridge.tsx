import { useMemo, useState } from 'react';
import { Copy, Download, RotateCcw } from 'lucide-react';
import { copyGuidance, formatInZone, generateCalendar, zonedDateTimeToUtc } from '@/lib/tools';
const fallback = [
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Australia/Sydney',
];
const zones = Array.from(
  new Set([
    ...(typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []),
    ...fallback,
  ]),
).sort();
export default function TimeBridge() {
  const [dateTime, setDateTime] = useState('');
  const [source, setSource] = useState('Asia/Kolkata');
  const [target, setTarget] = useState('America/New_York');
  const [search, setSearch] = useState('');
  const [duration, setDuration] = useState('');
  const result = useMemo(() => {
    try {
      return dateTime ? { value: zonedDateTimeToUtc(dateTime, source) } : null;
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Choose a valid time.' };
    }
  }, [dateTime, source]);
  const shown = Array.from(
    new Set([
      source,
      target,
      ...zones
        .filter((zone) => zone.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
        .slice(0, 80),
    ]),
  );
  const bridge = result && 'value' in result ? result.value : null;
  const details = bridge
    ? `Meeting details\n${formatInZone(bridge.utc, source)} (${source})\n${formatInZone(bridge.utc, target)} (${target})${duration ? `\nDuration: ${duration} minutes` : ''}`
    : '';
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(details);
    } catch {
      alert(copyGuidance('blocked'));
    }
  };
  const ics = () => {
    if (!bridge) return;
    const mins = Number(duration);
    if (!Number.isFinite(mins) || mins <= 0) {
      alert('Enter a positive duration before downloading a calendar file.');
      return;
    }
    const uid = `${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}@jugaad.best`;
    const body = generateCalendar({ start: bridge.utc, durationMinutes: mins, uid });
    const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'meeting.ics';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="tool-panel time-panel" aria-labelledby="time-tool-title">
      <div className="tool-panel-head">
        <div>
          <p className="tool-kicker">cross the clock</p>
          <h1 id="time-tool-title">Time Bridge</h1>
          <p>
            Compare a real IANA time zone in your browser. No calendar is connected and nothing is
            booked.
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
            Find a time zone
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search IANA zones"
            />
          </label>
          <label>
            From
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {shown.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </label>
          <button
            className="quiet-button"
            type="button"
            onClick={() => {
              setSource(target);
              setTarget(source);
            }}
          >
            Swap zones
          </button>
          <label>
            To
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {shown.map((zone) => (
                <option key={zone}>{zone}</option>
              ))}
            </select>
          </label>
          <label>
            Optional duration (minutes)
            <input
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 30"
            />
          </label>
          <button
            className="quiet-button"
            type="button"
            onClick={() => {
              setDateTime('');
              setSource('Asia/Kolkata');
              setTarget('America/New_York');
              setSearch('');
              setDuration('');
            }}
          >
            <RotateCcw aria-hidden="true" /> Reset planner
          </button>
        </div>
        <output className="time-result" aria-live="polite">
          {!result ? (
            <div className="empty-state">
              <strong>Choose a meeting time.</strong>
              <span>The converted time will appear here.</span>
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
                <p>
                  UTC: {bridge.utc.toISOString().replace('T', ' ').slice(0, 16)} · Date and offsets
                  are shown in both views.
                </p>
                {bridge.ambiguous && (
                  <p className="dst-note">
                    This time occurs twice at a daylight-saving change. We show the earlier
                    occurrence.
                  </p>
                )}
                <button className="quiet-button" type="button" onClick={copy}>
                  <Copy aria-hidden="true" /> Copy meeting details
                </button>
                <button className="quiet-button" type="button" disabled={!duration} onClick={ics}>
                  <Download aria-hidden="true" /> Download .ics
                </button>
                <p className="tool-footnote">
                  Check consequential meeting details before you send anything.
                </p>
              </>
            )
          )}
        </output>
      </div>
    </section>
  );
}
