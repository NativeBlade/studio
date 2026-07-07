import { useEffect, useState } from 'react';
import { ChevronDown, History, Loader, Square, Terminal } from 'lucide-react';
import { mdToHtml } from '../../lib/md.js';

function fmtDur(ms) {
    const sec = Math.max(1, Math.floor(ms / 1000));
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ${sec % 60}s`;
    return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

/**
 * One run's chain of thought, collapsed into an accordion — narration and the
 * exact commands the AI runs live inside; the header carries the elapsed
 * timer and the Stop button while the run is live.
 */
export function ProgressGroup({ group, live, onStop }) {
    const [open, setOpen] = useState(false);
    const items = group.items;
    const latest = items[items.length - 1];

    // Elapsed time: ticks every second while live, freezes at total once done.
    const [nowTs, setNowTs] = useState(Date.now());
    useEffect(() => {
        if (!live) return undefined;
        const t = setInterval(() => setNowTs(Date.now()), 1000);
        return () => clearInterval(t);
    }, [live]);
    const endTs = group.endedAt ?? (live ? nowTs : group.startedAt);
    const dur = fmtDur(endTs - group.startedAt);

    return (
        <div style={{ borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px' }}>
                <button onClick={() => items.length && setOpen((o) => !o)} className="nb-btn" style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center', gap: 8, background: 'none', border: 'none', textAlign: 'left', padding: 0, cursor: items.length ? 'pointer' : 'default' }}>
                    {live
                        ? <Loader size={13} className="nb-spin" style={{ color: '#ffce7a', flexShrink: 0 }} />
                        : <History size={13} style={{ color: '#9aa0a8', flexShrink: 0 }} />}
                    <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: '#9aa0a8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {live ? 'Working…' : 'Build details'}{items.length > 0 && <> · {items.length} update{items.length === 1 ? '' : 's'}</>}
                        <span style={{ color: live ? '#ffce7a' : '#6b7280' }}> · {dur}</span>
                    </span>
                    {items.length > 0 && <ChevronDown size={13} style={{ color: '#6b7280', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
                </button>
                {live && (
                    <button onClick={onStop} className="nb-btn" title="Stop" style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: 11.5, fontWeight: 600, color: '#ff8585', background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.3)', borderRadius: 8, padding: '4px 9px' }}>
                        <Square size={9} fill="currentColor" />Stop
                    </button>
                )}
            </div>

            {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px 12px' }}>
                    {items.map((it) => it.kind === 'tool' ? (
                        <div key={it.id} style={{ borderRadius: 10, padding: '7px 12px', fontSize: 12, background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#9aa0a8' }}>
                                <Terminal size={11} style={{ color: '#ffce7a', flexShrink: 0 }} />{it.text}
                            </div>
                            {it.detail && (
                                <div style={{ marginTop: 5, fontFamily: 'Consolas, monospace', fontSize: 11.5, color: '#86e89a', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>$ {it.detail}</div>
                            )}
                        </div>
                    ) : (
                        <div key={it.id} style={{ borderRadius: 10, padding: '8px 12px', fontSize: 12.5, lineHeight: 1.55, background: 'rgba(255,255,255,0.03)', color: '#9aa0a8' }} dangerouslySetInnerHTML={{ __html: mdToHtml(it.text || '') }} />
                    ))}
                </div>
            )}

            {live && !open && latest && (
                <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontStyle: latest.kind === 'text' ? 'italic' : 'normal', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {latest.kind === 'tool' && <Terminal size={11} style={{ color: '#ffce7a', flexShrink: 0 }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{latest.kind === 'tool' && latest.detail ? `${latest.text} — ${latest.detail}` : (latest.text || '').replace(/[*`#]/g, '').slice(0, 140)}</span>
                </div>
            )}
        </div>
    );
}
