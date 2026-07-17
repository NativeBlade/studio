import { useState } from 'react';
import { mdToHtml } from '../../lib/md.js';
import logo from '../../assets/nb-logo.png';
import { useT } from '../../lib/i18n.js';

/**
 * The plan approval wizard, ported from the cloud Studio: Features (checkable
 * steps) → Design (question chips + "Other:") → Review → Approve & build.
 */
export function PlanWizard({ plan, approved, onApprove, onReject }) {
    const t = useT();
    const stageLabel = { Features: t('plan.features'), Design: t('plan.design'), Keys: t('plan.keys'), Review: t('plan.review') };
    const questions = plan.questions ?? [];
    // Keys the planned features can't work without. Asked HERE, before a line of
    // code exists, instead of mid-build: an agent 100 steps deep forgets to ask
    // properly and blurts the request into the chat, which is exactly what the
    // masked field exists to prevent.
    const planSecrets = plan.secrets ?? [];
    const stages = [
        'Features',
        ...(questions.length ? ['Design'] : []),
        ...(planSecrets.length ? ['Keys'] : []),
        'Review',
    ];
    const [stage, setStage] = useState(0);
    const [changing, setChanging] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [picked, setPicked] = useState(() => plan.steps.map(() => true));
    const toggle = (i) => setPicked((p) => p.map((v, j) => (j === i ? !v : v)));
    const selected = plan.steps.filter((_, i) => picked[i]);
    const [qa, setQa] = useState({});
    const pickAnswer = (qi, option, multi) => setQa((prev) => {
        const cur = prev[qi] ?? (multi ? [] : null);
        if (!multi) return { ...prev, [qi]: cur === option ? null : option };
        const list = cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option];
        return { ...prev, [qi]: list };
    });
    const [other, setOther] = useState({});
    const answers = questions.map((q, qi) => {
        const parts = [].concat(qa[qi] ?? []).filter(Boolean);
        if ((other[qi] ?? '').trim()) parts.push(other[qi].trim());
        return parts.length ? { question: q.question, answer: parts.join(', ') } : null;
    }).filter(Boolean);
    // Never defaulted or pre-filled: an empty value means "skip", and the build
    // is told the key is missing rather than pretending it's there.
    const [keyVals, setKeyVals] = useState({});
    const secrets = planSecrets.map((s) => ({ ...s, value: (keyVals[s.env] ?? '').trim() }));

    const label = stages[stage];
    const canNext = label !== 'Features' || selected.length > 0;

    return (
        <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ marginTop: 2, display: 'flex', height: 28, width: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 99, background: 'linear-gradient(135deg,rgba(255,90,90,0.3),rgba(124,58,237,0.25))' }}>
                <img src={logo} alt="" style={{ height: 16, width: 16, objectFit: 'contain' }} />
            </span>
            <div style={{ flex: 1, borderRadius: 16, padding: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,77,77,0.28)', opacity: approved ? 0.6 : 1, pointerEvents: approved ? 'none' : 'auto' }}>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    {stages.map((st, i) => (
                        <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {i > 0 && <div style={{ height: 1, width: 20, background: 'rgba(255,255,255,0.12)' }} />}
                            <button onClick={() => i < stage && setStage(i)} style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 600, cursor: i < stage ? 'pointer' : 'default', pointerEvents: i <= stage ? 'auto' : 'none', background: i === stage ? 'rgba(220,38,38,0.16)' : 'rgba(255,255,255,0.04)', border: `1px solid ${i === stage ? 'rgba(255,77,77,0.4)' : 'rgba(255,255,255,0.1)'}`, color: i === stage ? '#fff' : i < stage ? '#ff8585' : '#6b7280' }}>
                                <span>{i + 1}</span>{stageLabel[st]}
                            </button>
                        </div>
                    ))}
                </div>
                <div style={{ marginBottom: 12, fontSize: 13.5, color: '#fff' }} dangerouslySetInnerHTML={{ __html: mdToHtml(plan.summary || '') }} />

                {label === 'Features' && (
                    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {plan.steps.map((st, i) => (
                            <label key={i} style={{ display: 'flex', cursor: 'pointer', alignItems: 'flex-start', gap: 10, borderRadius: 10, padding: '8px 10px', fontSize: 13, background: picked[i] ? 'rgba(255,255,255,0.04)' : 'transparent', border: `1px solid ${picked[i] ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`, color: picked[i] ? '#e7e9ee' : '#6b7280', textDecoration: picked[i] ? 'none' : 'line-through' }}>
                                <input type="checkbox" checked={picked[i]} onChange={() => toggle(i)} style={{ marginTop: 2, height: 14, width: 14, flexShrink: 0, accentColor: '#dc2626' }} />
                                <span dangerouslySetInnerHTML={{ __html: mdToHtml(st) }} />
                            </label>
                        ))}
                    </div>
                )}

                {label === 'Design' && (
                    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {questions.map((q, qi) => (
                            <div key={qi}>
                                <div style={{ marginBottom: 6, fontSize: 12.5, fontWeight: 600, color: '#e7e9ee' }}>
                                    {q.question}{q.multi && <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 400, color: '#6b7280' }}>{t('plan.selectAll')}</span>}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {(q.options ?? []).map((op) => {
                                        const on = q.multi ? (qa[qi] ?? []).includes(op) : qa[qi] === op;
                                        return <button key={op} onClick={() => pickAnswer(qi, op, !!q.multi)} className="nb-btn" style={{ borderRadius: 99, padding: '6px 12px', fontSize: 12, background: on ? 'rgba(220,38,38,0.16)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? 'rgba(255,77,77,0.45)' : 'rgba(255,255,255,0.12)'}`, color: on ? '#fff' : '#c2c7cf' }}>{op}</button>;
                                    })}
                                </div>
                                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '6px 12px', background: (other[qi] ?? '').trim() ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${(other[qi] ?? '').trim() ? 'rgba(255,77,77,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
                                    <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 500, color: '#9aa0a8' }}>{t('plan.other')}</span>
                                    <input value={other[qi] ?? ''} onChange={(e) => setOther((p) => ({ ...p, [qi]: e.target.value }))} placeholder={t('plan.otherPlaceholder')} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: '#e7e9ee' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {label === 'Keys' && (
                    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ fontSize: 12, lineHeight: 1.5, color: '#9aa0a8' }}>{t('plan.keysIntro')}</div>
                        {planSecrets.map((s) => (
                            <div key={s.env}>
                                <div style={{ marginBottom: 5, fontSize: 12.5, fontWeight: 600, color: '#e7e9ee' }}>{s.label}</div>
                                <input
                                    type="password"
                                    value={keyVals[s.env] ?? ''}
                                    onChange={(e) => setKeyVals((p) => ({ ...p, [s.env]: e.target.value }))}
                                    placeholder={s.env}
                                    autoComplete="off"
                                    spellCheck={false}
                                    className="nb-field"
                                    style={{ width: '100%', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, fontFamily: 'monospace' }}
                                />
                                {s.help && <div style={{ marginTop: 5, fontSize: 11, lineHeight: 1.5, color: '#6b7280' }}>{s.help}</div>}
                            </div>
                        ))}
                        <div style={{ fontSize: 11, color: '#6b7280' }}>{t('plan.keysSkip')}</div>
                    </div>
                )}

                {label === 'Review' && !changing && (
                    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div>
                            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9aa0a8' }}>{t('plan.featuresCount', { n: selected.length })}</div>
                            {selected.map((st, i) => <div key={i} style={{ fontSize: 12.5, color: '#c2c7cf' }}>• <span dangerouslySetInnerHTML={{ __html: mdToHtml(st) }} /></div>)}
                        </div>
                        {answers.length > 0 && (
                            <div>
                                <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c4b5fd' }}>{t('plan.designPrefs')}</div>
                                {answers.map((a, i) => <div key={i} style={{ fontSize: 12.5, color: '#c2c7cf' }}>• {a.question} <span style={{ color: '#fff' }}>{a.answer}</span></div>)}
                            </div>
                        )}
                        {secrets.length > 0 && (
                            <div>
                                <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9aa0a8' }}>{t('plan.keys')}</div>
                                {/* Status only — the value never gets rendered anywhere. */}
                                {secrets.map((s) => (
                                    <div key={s.env} style={{ fontSize: 12.5, color: '#c2c7cf' }}>
                                        • {s.label} <span style={{ color: s.value ? '#86e89a' : '#6b7280' }}>{s.value ? t('plan.keyFilled') : t('plan.keySkipped')}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {label === 'Review' && changing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} placeholder={t('plan.changePlaceholder')} className="nb-field" style={{ width: '100%', resize: 'none', borderRadius: 10, padding: '8px 12px', fontSize: 13 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => onReject(feedback)} disabled={!feedback.trim()} className="nb-btn" style={{ borderRadius: 10, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, color: '#fff', border: 'none', background: feedback.trim() ? 'linear-gradient(180deg,#8b5cf6,#6d28d9)' : 'rgba(255,255,255,0.06)' }}>{t('plan.replan')}</button>
                            <button onClick={() => setChanging(false)} className="nb-btn" style={{ borderRadius: 10, padding: '6px 12px', fontSize: 12.5, background: 'none', border: 'none', color: '#9aa0a8' }}>{t('plan.cancel')}</button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                        {stage > 0 && <button onClick={() => setStage(stage - 1)} className="nb-btn" style={{ whiteSpace: 'nowrap', borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#c2c7cf' }}>{t('plan.back')}</button>}
                        {label !== 'Review' ? (
                            <button onClick={() => setStage(stage + 1)} disabled={!canNext} className="nb-btn" style={{ whiteSpace: 'nowrap', borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#fff', border: 'none', background: canNext ? 'linear-gradient(180deg,#ff5151,#d31f1f)' : 'rgba(255,255,255,0.06)' }}>{t('plan.next')}</button>
                        ) : (
                            <>
                                <button onClick={() => onApprove(selected, answers, secrets)} disabled={!selected.length} className="nb-btn" style={{ whiteSpace: 'nowrap', borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#fff', border: 'none', background: selected.length ? 'linear-gradient(180deg,#ff5151,#d31f1f)' : 'rgba(255,255,255,0.06)' }}>{t('plan.approve')}</button>
                                <button onClick={() => setChanging(true)} className="nb-btn" style={{ whiteSpace: 'nowrap', borderRadius: 10, padding: '6px 14px', fontSize: 12, fontWeight: 500, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#c2c7cf' }}>{t('plan.requestChanges')}</button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
