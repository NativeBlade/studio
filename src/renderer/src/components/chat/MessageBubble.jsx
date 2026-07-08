import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { mdToHtml } from '../../lib/md.js';
import logo from '../../assets/nb-logo.png';
import { useT } from '../../lib/i18n.js';

/** One chat message: AI on the left (markdown), user on the right, copy on hover. */
export function MessageBubble({ message }) {
    const t = useT();
    const isUser = message.role === 'user';
    const isError = message.role === 'error';
    const [hover, setHover] = useState(false);
    const [copied, setCopied] = useState(false);

    if (message.role === 'system') {
        return <div style={{ textAlign: 'center', fontSize: 12, fontStyle: 'italic', color: '#6b7280' }}>{message.text}</div>;
    }

    const copy = () => {
        navigator.clipboard.writeText(message.text || '');
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
    };

    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ display: 'flex', gap: 12, flexDirection: isUser ? 'row-reverse' : 'row' }}
        >
            <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: isUser ? 'linear-gradient(135deg,#ff5a5a,#b91c1c)' : 'linear-gradient(135deg,rgba(255,90,90,0.3),rgba(124,58,237,0.25))', color: '#fff' }}>
                {isUser ? t('message.you') : <img src={logo} alt="" style={{ height: 16, width: 16, objectFit: 'contain' }} />}
            </span>
            <div style={{ minWidth: 0, maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', gap: 4 }}>
                <div
                    style={{
                        borderRadius: 16, padding: '11px 15px', fontSize: 13.5, lineHeight: 1.55,
                        // Wrap long unbroken strings (URLs, tokens) instead of overflowing;
                        // pre-wrap keeps the user's own line breaks.
                        overflowWrap: 'anywhere', wordBreak: 'break-word', whiteSpace: isUser ? 'pre-wrap' : 'normal',
                        background: isUser ? 'linear-gradient(180deg,#ff5151,#d31f1f)' : isError ? 'rgba(255,69,58,0.1)' : 'rgba(255,255,255,0.05)',
                        border: isUser ? 'none' : `1px solid ${isError ? 'rgba(255,69,58,0.35)' : 'rgba(255,255,255,0.08)'}`,
                        color: isError ? '#ff8585' : '#e7e9ee',
                    }}
                >
                    {isUser ? message.text : <div dangerouslySetInnerHTML={{ __html: mdToHtml(message.text || '') }} />}
                </div>
                <button
                    onClick={copy}
                    className="nb-btn"
                    title={t('message.copyTitle')}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, height: 20, padding: '0 6px', borderRadius: 6, fontSize: 10.5, fontWeight: 500, background: 'none', border: 'none', color: copied ? '#86e89a' : '#6b7280', opacity: hover || copied ? 1 : 0, transition: 'opacity .15s' }}
                >
                    {copied ? <><Check size={11} />{t('message.copied')}</> : <><Copy size={11} />{t('message.copy')}</>}
                </button>
            </div>
        </div>
    );
}
