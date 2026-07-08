import { useEffect, useRef } from 'react';
import { useChatStore } from '../../stores/chat.js';
import { MessageBubble } from './MessageBubble.jsx';
import { ProgressGroup } from './ProgressGroup.jsx';
import { PlanWizard } from './PlanWizard.jsx';
import { Checkpoint } from './Checkpoint.jsx';
import { SecretCard } from './SecretCard.jsx';
import { Composer } from './Composer.jsx';
import { useT } from '../../lib/i18n.js';

const EMPTY = []; // stable reference — a fresh [] per render makes zustand re-render forever

/** The conversation with the AI for one app: messages, chain-of-thought groups, plan wizard, input. */
export function ChatPanel({ app }) {
    const t = useT();
    const messages = useChatStore((s) => s.byApp[app.id] ?? EMPTY);
    const busy = useChatStore((s) => s.busy[app.id] ?? false);
    const send = useChatStore((s) => s.send);
    const stop = useChatStore((s) => s.stop);
    const approvePlan = useChatStore((s) => s.approvePlan);
    const rejectPlan = useChatStore((s) => s.rejectPlan);
    const restore = useChatStore((s) => s.restore);
    const resolveSecret = useChatStore((s) => s.resolveSecret);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const lastGroup = [...messages].reverse().find((m) => m.role === 'group');

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 20, overflow: 'hidden', background: 'linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {messages.length === 0 && (
                    <div style={{ margin: 'auto', textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
                        {t('chat.emptyPre')}<strong style={{ color: '#9aa0a8' }}>{app.name}</strong>{t('chat.emptyPost')}
                    </div>
                )}
                {messages.map((m) => {
                    if (m.role === 'group') return <ProgressGroup key={m.id} group={m} live={busy && m === lastGroup && !m.endedAt} onStop={() => stop(app.id)} />;
                    if (m.role === 'plan') return <PlanWizard key={m.id} plan={m.plan} approved={m.approved} onApprove={(steps, answers) => approvePlan(app, steps, answers)} onReject={(feedback) => rejectPlan(app, feedback)} />;
                    if (m.role === 'checkpoint') return <Checkpoint key={m.id} cp={m} onRestore={() => restore(app, m)} />;
                    if (m.role === 'secret') return <SecretCard key={m.id} message={m} onResolve={(value) => resolveSecret(app, m, value)} />;
                    return <MessageBubble key={m.id} message={m} />;
                })}
            </div>

            <Composer busy={busy} onSend={(text) => send(app, text)} />
        </div>
    );
}
