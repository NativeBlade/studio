/**
 * "Point at it": the user clicks something in the preview and the AI gets
 * told what, instead of the user describing a button in words.
 *
 * The app renders inside an iframe of the shell page, so the script below
 * runs in the shell (webview.executeJavaScript) and installs a capturing
 * click listener on the visible app frame's document. Every navigation
 * replaces that document, so it re-installs on a short timer while the mode
 * is on. A pick is reported through console.info with a marker the Studio's
 * console listener recognises; the click itself is swallowed, so pointing at
 * a button never presses it.
 */

export const PICK_MARKER = '[NB:STUDIO:PICK]';

export const PICKER_SCRIPT = `
(function () {
    if (window.__nbStudioPick) return;
    var MARKER = ${JSON.stringify(PICK_MARKER)};
    function frame() {
        var best = null, area = 0;
        document.querySelectorAll('iframe').forEach(function (f) {
            var cs = getComputedStyle(f);
            if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
            var r = f.getBoundingClientRect();
            if (r.width * r.height > area) { area = r.width * r.height; best = f; }
        });
        return best;
    }
    function describe(el) {
        var comp = el.closest('[wire\\\\:id]');
        var name = null;
        if (comp) {
            try { name = JSON.parse(comp.getAttribute('wire:snapshot') || '{}').memo.name || null; } catch (e) {}
        }
        var text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
        var attrs = {};
        ['id', 'wire:click', 'wire:model', 'wire:nb-navigate', 'href', 'name', 'type', 'data-nb'].forEach(function (a) {
            var v = el.getAttribute(a); if (v) attrs[a] = v.slice(0, 120);
        });
        var path = [];
        var cur = el;
        while (cur && cur.nodeType === 1 && path.length < 4) {
            var seg = cur.tagName.toLowerCase();
            if (cur.id) seg += '#' + cur.id;
            else if (cur.classList.length) seg += '.' + Array.prototype.slice.call(cur.classList, 0, 3).join('.');
            path.unshift(seg);
            cur = cur.parentElement;
        }
        return { tag: el.tagName.toLowerCase(), text: text, attrs: attrs, component: name, path: path.join(' > '), page: location.pathname };
    }
    function install() {
        var f = frame();
        var doc = f && f.contentDocument;
        if (!doc || doc.__nbStudioPick) return;
        doc.__nbStudioPick = true;
        doc.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            var el = e.target && e.target.nodeType === 1 ? e.target : null;
            if (!el) return;
            var prev = el.style.outline;
            el.style.outline = '2px solid #ff4d4d';
            setTimeout(function () { el.style.outline = prev; }, 600);
            var info = describe(el);
            info.page = (f.contentWindow && f.contentWindow.location && f.contentWindow.location.pathname) || info.page;
            console.info(MARKER + JSON.stringify(info));
        }, true);
        if (doc.body) doc.body.style.cursor = 'crosshair';
    }
    install();
    window.__nbStudioPick = setInterval(install, 400);
})();
`;

export const PICKER_STOP_SCRIPT = `
(function () {
    if (window.__nbStudioPick) { clearInterval(window.__nbStudioPick); window.__nbStudioPick = null; }
    document.querySelectorAll('iframe').forEach(function (f) {
        try {
            var doc = f.contentDocument;
            if (doc && doc.__nbStudioPick) { doc.__nbStudioPick = false; if (doc.body) doc.body.style.cursor = ''; }
        } catch (e) {}
    });
})();
`;

/** A console line that is a pick report, parsed; null for anything else. */
export function parsePick(message) {
    const text = String(message || '');
    const at = text.indexOf(PICK_MARKER);
    if (at === -1) return null;
    try {
        const info = JSON.parse(text.slice(at + PICK_MARKER.length));
        return info && typeof info === 'object' ? info : null;
    } catch {
        return null;
    }
}

/** What the chip shows: the element's text, or its kind. */
export function pickLabel(info) {
    if (!info) return '';
    const kind = { a: 'link', button: 'button', input: 'field', textarea: 'field', select: 'field', img: 'image' }[info.tag] || info.tag;
    return info.text ? `${kind} "${info.text.slice(0, 40)}${info.text.length > 40 ? '…' : ''}"` : kind;
}

/** The note that rides in front of the user's message. */
export function describePick(info) {
    if (!info) return '';
    const attrs = Object.entries(info.attrs || {}).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `[The user pointed at this element in the live preview (page ${info.page || '/'}): <${info.tag}${attrs ? ' ' + attrs : ''}>${info.text ? ` with text "${info.text}"` : ''}`
        + `${info.component ? `, inside the Livewire component "${info.component}"` : ''}${info.path ? `; DOM path: ${info.path}` : ''}. "This", "here" or "that button" in the message means this element.]`;
}
