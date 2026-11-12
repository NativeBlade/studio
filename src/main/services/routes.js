/**
 * The app's own pages out of a `php artisan route:list --json` dump: GET
 * routes with no parameters, minus the framework's plumbing. Leaf module,
 * no Electron, so it is unit-tested.
 */

const SKIP = /^(_nativeblade|__nb|livewire|sanctum|storage|up$|_ignition|_debugbar|telescope|horizon|pulse)/;

/** @returns {string[]} paths, home first, then alphabetical */
export function appRoutes(routes) {
    const paths = [];
    for (const r of Array.isArray(routes) ? routes : []) {
        const method = String(r.method || '').split('|')[0];
        const uri = String(r.uri || '');
        if (method !== 'GET' || uri.includes('{') || SKIP.test(uri)) continue;
        const path = uri === '/' ? '/' : `/${uri.replace(/^\/+/, '')}`;
        if (!paths.includes(path)) paths.push(path);
    }
    return paths.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}
