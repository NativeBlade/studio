/** Tiny, escape-first markdown for chat bubbles (bold, code, lists, headers). */
export function mdToHtml(text) {
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const inline = (t) => t
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.09);border-radius:4px;padding:1px 5px;font-size:12px;overflow-wrap:anywhere;word-break:break-word">$1</code>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');

    return esc(text).split(/\r?\n/).map((line) => {
        if (/^#{1,4}\s+/.test(line)) return `<strong>${inline(line.replace(/^#{1,4}\s+/, ''))}</strong>`;
        if (/^\s*[-*]\s+/.test(line)) return `<span style="display:block;padding-left:10px">• ${inline(line.replace(/^\s*[-*]\s+/, ''))}</span>`;
        if (/^\s*\d+\.\s+/.test(line)) return `<span style="display:block;padding-left:10px">${inline(line)}</span>`;
        return inline(line);
    }).join('<br/>').replace(/(<br\/>){3,}/g, '<br/><br/>');
}
