import { useState } from 'react';
import { Plus } from 'lucide-react';
import { mdToHtml } from '../../lib/md.js';
import logo from '../../assets/nb-logo.png';
import { useT } from '../../lib/i18n.js';

const chip = (on) => ({ borderRadius: 99, padding: '6px 12px', fontSize: 12, background: on ? 'rgba(220,38,38,0.16)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? 'rgba(255,77,77,0.45)' : 'rgba(255,255,255,0.12)'}`, color: on ? '#fff' : '#c2c7cf' });
const heading = { marginBottom: 6, fontSize: 12.5, fontWeight: 600, color: '#e7e9ee' };
const hint = { marginLeft: 6, fontSize: 10.5, fontWeight: 400, color: '#6b7280' };

/**
 * The plan approval wizard: Features (the AI's steps, its optional extras and
 * the user's own additions) → Design (visual directions with a description,
 * palettes as real swatches, then any other open choice) → Keys → Review.
 * Style and palette go to the build as the chosen label plus the hex colors,
 * so the AI builds what the user saw, not a paraphrase of it.
 */
export function PlanWizard({ plan, approved, onApprove, onReject }) {
    const t = useT();
    const stageLabel = { Features: t('plan.features'), Design: t('plan.design'), Keys: t('plan.keys'), Review: t('plan.review') };
    const questions = plan.questions ?? [];
    const extras = plan.extras ?? [];
    const styles = plan.styles ?? [];
    const palettes = plan.palettes ?? [];
    const planSecrets = plan.secrets ?? [];
    const stages = [
        'Features',
        ...(styles.length || palettes.length || questions.length ? ['Design'] : []),
        ...(planSecrets.length ? ['Keys'] : []),
        'Review',
    ];
    const [stage, setStage] = useState(0);
    const [changing, setChanging] = useState(false);
    const [feedback, setFeedback] = useState('');

    // Features: the AI's steps (on), its extras (off) and the user's own lines.
    const [picked, setPicked] = useState(() => plan.steps.map(() => true));
    const toggle = (i) => setPicked((p) => p.map((v, j) => (j === i ? !v : v)));
    const [extraOn, setExtraOn] = useState({});
    const [custom, setCustom] = useState([]);
    const [draft, setDraft] = useState('');
    const addCustom = () => {
        const text = draft.trim();
        if (!text) return;
        setCustom((c) => [...c, text]);
        setDraft('');
    };
    const selected = [
        ...plan.steps.filter((_, i) => picked[i]),
        ...extras.filter((e) => extraOn[e.label]).map((e) => e.label),
        ...custom,
    ];

    // Design: one style, one palette, "Other" for each, then the open questions.
    const [style, setStyle] = useState(null);
    const [styleOther, setStyleOther] = useState('');
    const [palette, setPalette] = useState(null);
    const [paletteOther, setPaletteOther] = useState('');
    const [qa, setQa] = useState({});
    const pickAnswer = (qi, option, multi) => setQa((prev) => {
        const cur = prev[qi] ?? (multi ? [] : null);
        if (!multi) return { ...prev, [qi]: cur === option ? null : option };
        const list = cur.includes(option) ? cur.filter((o) => o !== option) : [...cur, option];
        return { ...prev, [qi]: list };
    });
    const [other, setOther] = useState({});
    const answers = [];
    const chosenStyle = styles.find((s) => s.label === style);
    if (chosenStyle || styleOther.trim()) {
        answers.push({ question: t('plan.style'), answer: [chosenStyle ? `${chosenStyle.label}: ${chosenStyle.description}` : null, styleOther.trim() || null].filter(Boolean).join('; ') });
    }
    const chosenPalette = palettes.find((p) => p.label === palette);
    if (chosenPalette || paletteOther.trim()) {
        answers.push({ question: t('plan.palette'), answer: [chosenPalette ? `${chosenPalette.label} (background ${chosenPalette.colors[0]}, surface ${chosenPalette.colors[1]}, primary ${chosenPalette.colors[2]}${chosenPalette.colors[3] ? `, secondary ${chosenPalette.colors[3]}` : ''})` : null, paletteOther.trim() || null].filter(Boolean).join('; ') });
    }
    questions.forEach((q, qi) => {
        const parts = [].concat(qa[qi] ?? []).filter(Boolean);
        if ((other[qi] ?? '').trim()) parts.push(other[qi].trim());
        if (parts.length) answers.push({ question: q.question, answer: parts.join(', ') });
    });

    // Never defaulted or pre-filled: an empty value means "skip".
    const [keyVals, setKeyVals] = useState({});
    const secrets = planSecrets.map((s) => ({ ...s, value: (keyVals[s.env] ?? '').trim() }));

    const label = stages[stage];
    const canNext = label !== 'Features' || selected.length > 0;

    const otherField = (value, onChange) => (
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '6px 12px', background: value.trim() ? 'rgba(220,38,38,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${value.trim() ? 'rgba(255,77,77,0.4)' : 'rgba(255,255,255,0.1)'}` }}>
            <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 500, color: '#9aa0a8' }}>{t('plan.other')}</span>
            <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={t('plan.otherPlaceholder')} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: '#e7e9ee' }} />
        </div>
    );

    return (
        <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ marginTop: 2, display: 'flex', height: 28, width: 28, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 99, background: 'linear-gradient(135deg,rgba(255,90,90,0.3),rgba(124,58,237,0.25))' }}>
                <img src={logo} alt="" style={{ height: 16, width: 16, objectFit: 'contain' }} />
            </span>
            <div style={{ flex: 1, minWidth: 0, borderRadius: 16, padding: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,77,77,0.28)', opacity: approved ? 0.6 : 1, pointerEvents: approved ? 'none' : 'auto' }}>
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
                        {custom.map((text, i) => (
                            <label key={`c${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, borderRadius: 10, padding: '8px 10px', fontSize: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#e7e9ee' }}>
                                <input type="checkbox" checked onChange={() => setCustom((c) => c.filter((_, j) => j !== i))} style={{ marginTop: 2, height: 14, width: 14, flexShrink: 0, accentColor: '#dc2626' }} />
                                <span>{text}</span>
                            </label>
                        ))}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 10, padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.14)' }}>
                            <Plus size={13} style={{ color: '#9aa0a8', flexShrink: 0 }} />
                            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }} placeholder={t('plan.addPlaceholder')} style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 12.5, color: '#e7e9ee' }} />
                            {draft.trim() && <button onClick={addCustom} className="nb-btn" style={{ ...chip(true), padding: '3px 10px', flexShrink: 0 }}>{t('plan.addFeature')}</button>}
                        </div>
                        {extras.length > 0 && (
                            <div style={{ marginTop: 8 }}>
                                <div style={heading}>{t('plan.extras')}<span style={hint}>{t('plan.extrasHint')}</span></div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {extras.map((e) => (
                                        <button key={e.label} onClick={() => setExtraOn((p) => ({ ...p, [e.label]: !p[e.label] }))} title={e.why} className="nb-btn" style={chip(!!extraOn[e.label])}>
                                            {extraOn[e.label] ? '✓ ' : '+ '}{e.label}
                                        </button>
                                    ))}
                                </div>
                                {extras.some((e) => extraOn[e.label] && e.why) && (
                                    <div style={{ marginTop: 6, fontSize: 11.5, lineHeight: 1.5, color: '#9aa0a8' }}>
                                        {extras.filter((e) => extraOn[e.label] && e.why).map((e) => <div key={e.label}>• <span style={{ color: '#c2c7cf' }}>{e.label}:</span> {e.why}</div>)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {label === 'Design' && (
                    <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {styles.length > 0 && (
                            <div>
                                <div style={heading}>{t('plan.style')}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 6 }}>
                                    {styles.map((s) => {
                                        const on = style === s.label;
                                        return (
                                            <button key={s.label} onClick={() => setStyle(on ? null : s.label)} className="nb-btn" style={{ textAlign: 'left', borderRadius: 12, padding: '9px 11px', background: on ? 'rgba(220,38,38,0.16)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? 'rgba(255,77,77,0.45)' : 'rgba(255,255,255,0.12)'}`, color: on ? '#fff' : '#c2c7cf' }}>
                                                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{s.label}</div>
                                                {s.description && <div style={{ marginTop: 3, fontSize: 11, lineHeight: 1.45, color: on ? '#ffd0d0' : '#9aa0a8' }}>{s.description}</div>}
                                            </button>
                                        );
                                    })}
                                </div>
                                {otherField(styleOther, setStyleOther)}
                            </div>
                        )}
                        {palettes.length > 0 && (
                            <div>
                                <div style={heading}>{t('plan.palette')}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {palettes.map((p) => {
                                        const on = palette === p.label;
                                        return (
                                            <button key={p.label} onClick={() => setPalette(on ? null : p.label)} className="nb-btn" title={p.colors.join(' ')} style={{ display: 'flex', alignItems: 'center', gap: 8, ...chip(on), padding: '5px 10px 5px 6px' }}>
                                                <span style={{ display: 'flex', gap: 2, borderRadius: 99, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.18)' }}>
                                                    {p.colors.map((c, i) => <span key={i} style={{ width: 14, height: 18, background: c }} />)}
                                                </span>
                                                {p.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {otherField(paletteOther, setPaletteOther)}
                            </div>
                        )}
                        {questions.map((q, qi) => (
                            <div key={qi}>
                                <div style={heading}>
                                    {q.question}{q.multi && <span style={hint}>{t('plan.selectAll')}</span>}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                    {(q.options ?? []).map((op) => {
                                        const on = q.multi ? (qa[qi] ?? []).includes(op) : qa[qi] === op;
                                        return <button key={op} onClick={() => pickAnswer(qi, op, !!q.multi)} className="nb-btn" style={chip(on)}>{op}</button>;
                                    })}
                                </div>
                                {otherField(other[qi] ?? '', (v) => setOther((p) => ({ ...p, [qi]: v })))}
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
                        {(chosenStyle || chosenPalette || answers.length > 0) && (
                            <div>
                                <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c4b5fd' }}>{t('plan.designPrefs')}</div>
                                {chosenPalette && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                        <span style={{ display: 'flex', gap: 2, borderRadius: 99, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.18)' }}>
                                            {chosenPalette.colors.map((c, i) => <span key={i} style={{ width: 14, height: 18, background: c }} />)}
                                        </span>
                                        <span style={{ fontSize: 12.5, color: '#fff' }}>{chosenPalette.label}</span>
                                    </div>
                                )}
                                {answers.map((a, i) => <div key={i} style={{ fontSize: 12.5, color: '#c2c7cf' }}>• {a.question} <span style={{ color: '#fff' }}>{a.answer}</span></div>)}
                            </div>
                        )}
                        {secrets.length > 0 && (
                            <div>
                                <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#9aa0a8' }}>{t('plan.keys')}</div>
                                {secrets.map((s) => (
                                    <div key={s.env} style={{ fontSize: 12.5, color: '#c2c7cf' }}>
                                        • {s.label} <span style={{ color: s.value ? '#86e89a' : '#6b7280' }}>{s.value ? t('plan.keyFilled') : t('plan.keySkipped')}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div style={{ fontSize: 11.5, lineHeight: 1.5, color: '#6b7280' }}>{t('plan.whatNext')}</div>
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
