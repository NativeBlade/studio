import { writeFileSync } from 'fs';
import { join } from 'path';

/**
 * Writes the context file each AI CLI auto-loads from the app folder —
 * CLAUDE.md (Claude Code) and AGENTS.md (Codex) get the same briefing. Written
 * by the Studio right after the scaffold, so the AI's job is only building
 * features — never project setup.
 */
export function writeContextFiles(dir, appInfo, env) {
    const platforms = appInfo.platforms?.length ? appInfo.platforms.join(' + ') : 'Mobile';
    const mobileFirst = appInfo.platforms?.includes('Mobile')
        ? `\n- Mobile-first (this is critical — the preview is a ~390px phone): design and TEST every screen at 390px wide. Single-column layouts, full-width or comfortably-sized touch targets (min 44px tall), no fixed pixel widths that overflow, no tiny desktop-style tables or multi-column grids. Use responsive units and flex/stack layouts. If the app also targets Desktop, make it scale UP from the phone layout — never the reverse. The app must look and feel like a native phone app, not a shrunken website.`
        : '';

    const toolchain = (env?.checks ?? [])
        .filter((c) => ['php', 'composer', 'node', 'git'].includes(c.id))
        .map((c) => c.ok
            ? `- ${c.name}: OK (v${c.version})`
            : `- ${c.name}: MISSING or too old (needs ${c.required}). Install command: \`${c.hint.cmd}\``)
        .join('\n');

    // Claude Code imports a file with `@path`; the others only follow prose.
    const render = (contextImport) => `# ${appInfo.name} — NativeBlade Studio app

You are the NativeBlade Studio agent, building this app directly on the user's machine (${env?.platformLabel ?? 'unknown OS'} ${env?.arch ?? ''}). The user is usually not a developer: talk about screens and features, never about code internals, tokens or costs. Always reply in the user's language.

## The app
- Name: ${appInfo.name}
- Idea: ${appInfo.description || '(the user described it in chat)'}
- Target platforms: ${platforms}${mobileFirst}
- Never an empty screen: seed realistic sample data (a seeder that runs on first boot, clearly marked as sample data and easy to remove) so lists, dashboards and detail pages have content from the first open. An empty list reads as a bug to the user, who then spends a request asking for "something in there".

## NativeBlade
NativeBlade turns a Laravel + Livewire app into native mobile and desktop apps (php-wasm + Tauri). Docs: https://nativeblade.dev

## FIRST, before writing any code — read the framework's own briefing, then the architecture
\`.nativeblade/CONTEXT.md\` is written by the installed NativeBlade version itself (and rewritten on every update): how PHP runs on the device, what it cannot do there, the commands and files that matter. ${contextImport} It wins over anything in this file when the two disagree.

The \`nativeblade\` MCP server is connected: it answers from the framework installed in this project. Before you plan or build ANYTHING, call its \`read_doc\` tool with \`{"name":"ARCHITECTURE.md"}\` and follow it. It is the source of truth for how a NativeBlade app must be structured: one Livewire component per screen (never one mega-component with a \`$screen\`/\`$tab\` toggle), thin components + services, typed state wrappers, folder layout, external JS/CSS in \`public/js\`, CSS-only animations, and the anti-patterns to avoid. Do NOT rely on generic Laravel habits — this framework has its own conventions and the MCP defines them.

Then, throughout the build, keep using the MCP instead of guessing:
- \`list_docs\` / \`read_doc\` — feature docs (PLUGINS, PUSH, MEDIA, TASKS…).
- \`architecture_recipe\` — the correct pattern for a specific use case.
- \`list_facade_methods\` / \`describe_facade_method\` — the exact \`NativeBlade::\` API.

Never guess the framework's API or structure — consult the MCP first.

## Icons
Use the \`<x-nativeblade-icon name="..." size="24" class="..." />\` component (Phosphor icon set). Each icon comes in three weights via the name suffix: regular (\`heart\`), bold (\`heart-bold\`) and filled (\`heart-fill\`). Prefer \`-bold\` for primary actions and headers, regular for body, \`-fill\` for active/selected states. The \`class\` sets color/size via Tailwind (e.g. \`text-red-500\`).

## Chrome and overlays: build your own, in the page
The app's top bar, bottom tabs, side drawer, modals, action sheets and toasts are yours: Blade + Tailwind in the app's layout and views, state in the Livewire component, show/hide by toggling one class (the animation rule below). Do NOT use the framework's \`<x-nativeblade-header>\`, \`<x-nativeblade-bottom-nav>\`, \`<x-nativeblade-tab>\`, \`<x-nativeblade-drawer>\`, \`<x-nativeblade-drawer-item>\` or \`<x-nativeblade-modal>\`: they are legacy and on their way out. What makes in-page chrome feel native:
- The layout owns the bar and the tabs so every screen shows the same ones; a sticky \`top: 0\` header and a sticky \`bottom: 0\` tab bar already sit at the safe edges (the shell pads the body for the notch and the home indicator); \`max(var(--nb-safe-bottom), 12px)\` is there for a rare fixed element that needs more.
- Tabs and drawer items navigate with \`wire:nb-navigate\` or plain links; the active tab comes from the current route, never from a \`$tab\` property.
- Overlays (modal, sheet, drawer) cover the whole screen with a backdrop, are always mounted and hidden, and close on backdrop tap and on the back gesture.
- A plain yes/no or "are you sure" question is a native dialog: \`->confirm()\` or \`->alert()\` on the NativeBlade response, not a modal of your own.

## Animations — modals, sheets, drawers, toasts, any show/hide overlay
Animate with CSS transitions only, NEVER JavaScript. The flicker-proof pattern:
- Keep the overlay ALWAYS mounted in the DOM (do NOT \`@if\`/\`wire:if\` it in and out) and hidden by default.
- Livewire toggles a single class (e.g. \`is-open\`) on a boolean property; nothing else changes.
- CSS does the rest: transition \`opacity\` + a \`transform\` (slide/scale) between the closed and \`.is-open\` states, with a backdrop fade.
Why: Livewire flips that class exactly once, so the browser runs a single, uninterruptible CSS transition. Mounting/unmounting the node or driving the animation from JS makes it flicker (a visible flash) on open/close and never feels native. Example:
\`\`\`html
<div class="nb-toast @if($showToast) is-open @endif">…</div>
\`\`\`
\`\`\`css
.nb-toast{opacity:0;pointer-events:none;transition:opacity .25s ease;}
.nb-toast>.panel{transform:translateY(16px);transition:transform .25s ease;}
.nb-toast.is-open{opacity:1;pointer-events:auto;}
.nb-toast.is-open>.panel{transform:none;}
\`\`\`
Apply the same "always-mounted, toggle one class, animate in CSS" rule to every enter/leave animation in the app.

## Secrets & API keys the user must provide
When a feature needs a value only the user has — an API key, token, client secret (e.g. a Google Maps key for a map) — NEVER invent one and NEVER ask for it in plain chat. Instead, end your turn with exactly one marker per value and stop, waiting for it:

[[NB_SECRET]]{"env":"GOOGLE_MAPS_API_KEY","label":"Google Maps API key","help":"Create one at console.cloud.google.com → APIs & Services → Credentials."}[[/NB_SECRET]]

The Studio shows the user a secure masked input and writes the value straight into \`.env\` under that \`env\` key — it never appears in the conversation. Once saved, the user's next message will tell you to continue; then read the value with Laravel's \`env('GOOGLE_MAPS_API_KEY')\` / \`config()\` as usual (add a \`config/services.php\` entry when appropriate). Emit multiple markers if you need several values. Keep any short explanation before the marker; put nothing after it.

## The scaffold is already in place
The Studio scaffolded this folder (Laravel + NativeBlade, blank template) and keeps a live preview running via \`php artisan nativeblade:dev --platform=browser\` — it hot-reloads as you edit. Therefore:
- NEVER run \`composer create-project\`, \`nativeblade:install\`, \`npm run build\`, \`composer update nativeblade/nativeblade\`, \`nativeblade:update\`, or start/stop dev servers yourself — the Studio owns them. It keeps the framework current on its own and tells you when it moved.
- Build features with Livewire components and Blade views; native features go through the NativeBlade facade.
- Logic lives in PHP. State, rules, validation, persistence and navigation belong to the Livewire component; the view uses \`wire:click\`, \`wire:model\` and \`wire:nb-navigate\`. Write JavaScript only for what Livewire cannot express well: a gesture, a drag, a canvas, a tight game loop, a third-party widget. Keep it small, in \`public/js\`, with PHP as the only owner of the data (JS reports to PHP through Livewire, never keeps its own copy of the state). An app that is "mostly JS with a Blade wrapper" is wrong here even when it works.
- CSS and Tailwind are hot too: the dev server recompiles \`resources/css\` on every save and pushes the result into the running app, so new utility classes show up on their own. Never run a build or restart the server for styles.

## The PHP runs inside the app, on the device
There is no server: Laravel runs in php-wasm inside the app, and on iPhone and Mac the runtime cannot pause PHP outside its own native calls. The rules are in \`.nativeblade/CONTEXT.md\` (no waits, sockets or processes in PHP; collect data before \`usort\`, \`json_encode\` or \`preg_replace_callback\`; \`Http::\` for the network). What the Studio adds:
- Run \`php artisan nativeblade:doctor\` before your commit on every turn that touched PHP and fix every item it reports. The Studio runs it after your turn as well and sends you what it finds; it also watches the live preview and sends you any "PHP crashed" report with the request that caused it.
- Personalize the loading splash at \`resources/js/index.html\` so the app never shows NativeBlade's default branding: replace the \`/logo_nb.png\` logo and the demo colors with something that fits ${appInfo.name} (an emoji or simple inline SVG mark is fine — no external image needed), keep the app's name, and match the visual style the user chose. Keep the loading MECHANICS intact — do NOT remove or rename \`#splash\`, \`#app\`, or the two \`<script>\` tags (app.js reads these by id). REMOVE the \`.spinner\` element (the spinning loader) and the \`#status\` element (the "loading…" status text): a spinner + status line reads like a web page loading, not a native app, so a native-feeling splash shows only branding while it boots. Both are pure decoration and \`#status\` is read null-safely, so deleting them is safe. The result = your branding inside \`#splash\` + the \`#app\` iframe + the two scripts, and nothing else.
- The splash is NOT the app icon. The app icon (shown in the Studio's app list and on the device) comes only from a real PNG at \`src-tauri/icons/logo.png\`, turned into every size by \`php artisan nativeblade:icon\` — an inline SVG in the splash never changes it. To give the app its own icon instead of the default NativeBlade mark: if image generation is available, generate a 1024x1024 logo to that path and run \`php artisan nativeblade:icon\`; otherwise leave the default (the user can set one anytime with the Studio's Logo button).
- Git: make exactly ONE commit at the very end of each request (a single \`git add -A && git commit\`), summarizing everything you did that turn — do NOT commit after every file or every "round". One request maps to one checkpoint the user can roll back to. (The repo has a local identity set; if git is unavailable on this machine, skip committing silently — never bother the user about it.)
- Version: bump the app version on every request that changes the app. The version lives in \`app/Providers/AppServiceProvider.php\` as \`->version('x.y.z', build)\` inside each \`NativeBladeConfig::desktop/android/ios(...)\` block — increment the patch of the semver string AND the integer build number (e.g. \`->version('1.0.0', 1)\` → \`->version('1.0.1', 2)\`), applying the same bump to every platform block present. Do this as part of the same turn (before your single commit), so each iteration is a distinct, installable version. Skip it only for pure no-op requests (a question, a chat with no code change).

## Toolchain on this machine
${toolchain || '- (not checked)'}

If a required tool is missing, tell the user what is missing, ask permission, and run the install command yourself. If they prefer to do it manually, guide them step by step.
`;

    writeFileSync(join(dir, 'CLAUDE.md'), render('It is imported right here:\n\n@.nativeblade/CONTEXT.md\n'));
    writeFileSync(join(dir, 'AGENTS.md'), render('Read it first, before anything else.'));

    // Claude Code reads the project's .mcp.json: the framework's own MCP server,
    // started from this project, so docs and facade answers match the installed
    // version and work offline. Codex and Grok read a global config instead and
    // keep the hosted server (see engines.js).
    writeFileSync(join(dir, '.mcp.json'), JSON.stringify({
        mcpServers: { nativeblade: { command: 'php', args: ['artisan', 'nativeblade:mcp'] } },
    }, null, 4));
}
