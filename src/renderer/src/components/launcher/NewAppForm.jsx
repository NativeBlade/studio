import { useState } from 'react';
import { Plus, Sparkles, Smartphone, Monitor } from 'lucide-react';
import { useAppsStore } from '../../stores/apps.js';
import { useChatStore } from '../../stores/chat.js';

const PLATFORMS = [['Mobile', Smartphone], ['Desktop', Monitor]];

/** New app card — cloud Studio style; creating drops straight into the chat. */
export function NewAppForm() {
    const addApp = useAppsStore((s) => s.addApp);
    const open = useAppsStore((s) => s.open);
    const startPlan = useChatStore((s) => s.startPlan);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [platforms, setPlatforms] = useState(['Mobile', 'Desktop']);

    // At least one platform is required — block deselecting the last one.
    const toggle = (p) => setPlatforms((cur) => {
        if (!cur.includes(p)) return [...cur, p];
        return cur.length > 1 ? cur.filter((x) => x !== p) : cur;
    });

    const start = () => {
        if (!name.trim() || !platforms.length) return;
        const id = crypto.randomUUID();
        const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
        // Unique slug: a repeated name must never land in another app's folder.
        const taken = new Set(useAppsStore.getState().apps.map((a) => a.slug));
        let slug = base;
        for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
        const app = { id, name: name.trim(), slug, description: description.trim(), platforms, path: null, createdAt: new Date().toISOString() };
        addApp(app);
        open(id);
        startPlan(app, app.description); // AI proposes the plan first — build only after approval
    };

    return (
        <div style={{ borderRadius: 20, padding: 24, background: 'linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))', border: '1px solid rgba(255,77,77,0.3)' }}>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#ff8585' }}>
                <Plus size={15} />New app
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="App name (e.g. FitTrack)"
                    className="nb-field"
                    style={{ width: '100%', borderRadius: 12, padding: '12px 16px', fontSize: 14 }}
                />
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Describe what it does, who it's for, and the key screens. The more detail, the better the first design."
                    className="nb-field"
                    style={{ width: '100%', resize: 'none', borderRadius: 12, padding: '12px 16px', fontSize: 14 }}
                />
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Build for:</span>
                    {PLATFORMS.map(([p, Icon]) => {
                        const on = platforms.includes(p);
                        return (
                            <button key={p} onClick={() => toggle(p)} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 99, padding: '6px 14px', fontSize: 12, fontWeight: 500, background: on ? 'rgba(220,38,38,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? 'rgba(255,77,77,0.4)' : 'rgba(255,255,255,0.12)'}`, color: on ? '#fff' : '#9aa0a8' }}>
                                <Icon size={13} />{p}
                            </button>
                        );
                    })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={start} disabled={!name.trim() || !platforms.length} className="nb-btn" style={{ display: 'flex', alignItems: 'center', gap: 8, borderRadius: 12, padding: '12px 20px', fontSize: 14, fontWeight: 600, color: '#fff', border: 'none', background: 'linear-gradient(180deg,#ff5151,#d31f1f)', boxShadow: '0 10px 24px -8px rgba(220,38,38,0.6)' }}>
                        <Sparkles size={16} />Start building
                    </button>
                </div>
            </div>
        </div>
    );
}
