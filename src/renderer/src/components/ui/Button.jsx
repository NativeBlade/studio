const styles = {
    primary: { background: 'linear-gradient(180deg,#ff5151,#d31f1f)', color: '#fff', border: 'none', boxShadow: '0 8px 20px -6px rgba(220,38,38,0.5)' },
    ghost: { background: 'rgba(255,255,255,0.05)', color: '#c2c7cf', border: '1px solid rgba(255,255,255,0.14)' },
    disabled: { background: 'rgba(255,255,255,0.06)', color: '#6b7280', border: 'none' },
};

export function Button({ variant = 'primary', disabled, children, style, ...props }) {
    return (
        <button
            disabled={disabled}
            style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '9px 16px', borderRadius: 11, fontSize: 13, fontWeight: 600,
                cursor: disabled ? 'default' : 'pointer',
                ...(disabled ? styles.disabled : styles[variant]),
                ...style,
            }}
            {...props}
        >
            {children}
        </button>
    );
}
