/**
 * After a build, open every screen once so what nobody clicked yet still gets
 * exercised: the shell's own navigation (`window.__nb.navigate`) walks the
 * app's GET routes in the preview webview, with a pause on each for Livewire
 * to render and the dev server to report. Errors and crashes land where they
 * always do (the console buffer, the crash fix turn); the tour only drives.
 */

const SETTLE_MS = 1800;
const MAX_ROUTES = 12;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const STEP_TIMEOUT_MS = 5000;

// executeJavaScript on a page mid-load can sit until the load ends; a screen
// that does not answer in time is skipped, not waited for.
function withDeadline(promise, ms) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

/**
 * @param {object} webview the preview's <webview> element
 * @param {string[]} routes paths to visit, home first
 * @returns {Promise<string[]>} the routes actually visited
 */
export async function tourScreens(webview, routes) {
    if (!webview || typeof webview.executeJavaScript !== 'function') return [];
    const list = routes.filter((r) => typeof r === 'string' && r.startsWith('/')).slice(0, MAX_ROUTES);
    const visited = [];
    for (const path of list) {
        try {
            await withDeadline(webview.executeJavaScript(`window.__nb && window.__nb.navigate(${JSON.stringify(path)}, { transition: 'none' }); true;`), STEP_TIMEOUT_MS);
            visited.push(path);
        } catch (e) {
            if (e?.message === 'timeout') continue; // this screen stalled; try the next
            break; // the webview went away (user left the app)
        }
        await wait(SETTLE_MS);
    }
    if (visited.length && visited[visited.length - 1] !== '/') {
        try { await withDeadline(webview.executeJavaScript(`window.__nb && window.__nb.navigate('/', { transition: 'none' }); true;`), STEP_TIMEOUT_MS); } catch { /* gone */ }
    }
    return visited;
}
