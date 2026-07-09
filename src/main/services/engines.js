import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { register, killTree } from './child-registry.js';

const MCP_URL = 'https://mcp.nativeblade.dev';

/**
 * Claude Code reads the project's .mcp.json, but Codex does NOT — it reads
 * ~/.codex/config.toml (project-level .codex/config.toml needs a "trusted
 * project", which headless runs don't get). So register the NativeBlade MCP in
 * Codex's global config once, idempotently — the streamable-HTTP way Codex
 * expects (`codex mcp add nativeblade --url ...` writes the same block).
 */
function ensureCodexMcp() {
    try {
        const dir = join(homedir(), '.codex');
        const file = join(dir, 'config.toml');
        const existing = existsSync(file) ? readFileSync(file, 'utf-8') : '';
        if (/\[mcp_servers\.nativeblade\]/.test(existing)) return; // already registered
        mkdirSync(dir, { recursive: true });
        const pad = existing && !existing.endsWith('\n') ? '\n' : '';
        writeFileSync(file, `${existing}${pad}\n[mcp_servers.nativeblade]\nurl = "${MCP_URL}"\n`);
    } catch { /* best-effort — Codex still works without the MCP */ }
}

/**
 * Grok Build (xAI's `grok` CLI) discovers MCP servers from its user-level
 * ~/.grok/config.toml. We write the exact block `grok mcp add --transport http`
 * produces (verified on a real install) so the format is authoritative, not a
 * guess — just faster than shelling out to the CLI on every session.
 */
function ensureGrokMcp() {
    try {
        const dir = join(homedir(), '.grok');
        const file = join(dir, 'config.toml');
        const existing = existsSync(file) ? readFileSync(file, 'utf-8') : '';
        if (/\[mcp_servers\.nativeblade\]/.test(existing)) return; // already registered
        mkdirSync(dir, { recursive: true });
        const pad = existing && !existing.endsWith('\n') ? '\n' : '';
        writeFileSync(file, `${existing}${pad}\n[mcp_servers.nativeblade]\nurl = "${MCP_URL}"\nenabled = true\n`);
    } catch { /* best-effort — Grok still runs without the MCP */ }
}

/**
 * The AI engines: each drives a coding CLI the user already subscribes to —
 * no API keys ever. Every adapter normalizes its CLI's output into the same
 * event stream: { text | tool | done | stopped | error }.
 *
 * Model lists are curated here in ONE place — update as vendors ship.
 */

export const ENGINES = {
    claude: {
        name: 'Claude Code',
        vendor: 'Anthropic',
        loginHint: 'run `claude` in a terminal and follow the login',
        recommended: true,
        models: [
            { id: null, label: 'Default (recommended)' },
            { id: 'opus', label: 'Claude Opus 4.8' },
            { id: 'sonnet', label: 'Claude Sonnet 5' },
        ],
    },
    codex: {
        name: 'Codex CLI',
        vendor: 'OpenAI',
        loginHint: 'run `codex login` in a terminal',
        models: [
            { id: null, label: 'Default (recommended)' },
            { id: 'gpt-5.5', label: 'GPT-5.5 (frontier)' },
            { id: 'gpt-5.4', label: 'GPT-5.4' },
            { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini' },
        ],
    },
    grok: {
        name: 'Grok Build',
        vendor: 'xAI',
        loginHint: 'run `grok login` and sign in with SuperGrok or X Premium+',
        // Real ids from `grok models`; Default (no -m) uses grok-composer-2.5-fast.
        models: [
            { id: null, label: 'Default (recommended)' },
            { id: 'grok-composer-2.5-fast', label: 'Composer 2.5 Fast' },
            { id: 'grok-build', label: 'Grok Build' },
        ],
    },
    // Gemini CLI is intentionally omitted: Google deprecated free "Gemini Code
    // Assist for individuals" sign-in in the CLI (it now points people to the
    // Antigravity suite), so the login no longer works for our BYO-subscription
    // model. Re-add here if that changes.
};

// Claude Code needs these to run composer/npm/artisan and edit files without
// pausing on tool prompts; conversational permission (asking the user in
// chat) is handled by the context-file instructions instead.
const CLAUDE_ALLOWED_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,TodoWrite,Task,NotebookEdit,mcp__nativeblade';

export function createSession({ engine = 'claude', model = null, cwd, emit }) {
    if (engine === 'codex') ensureCodexMcp(); // Codex needs the MCP in its global config, not .mcp.json
    if (engine === 'grok') ensureGrokMcp(); // same story for Grok Build
    const make = { claude: claudeSession, codex: codexSession, grok: grokSession }[engine] ?? claudeSession;
    return make({ model, cwd, emit });
}

/* ---------------------------------------------------------------- shared */

function spawnCli(command, args, cwd) {
    // detached on posix → the CLI becomes a process-group leader so stop()
    // can reap it and its children (not just the shell).
    return register(spawn(command, args, { cwd, shell: true, windowsHide: true, detached: process.platform !== 'win32' }));
}

function lineReader(child, onLine) {
    let buffer = '';
    child.stdout.on('data', (chunk) => {
        buffer += chunk.toString();
        let nl;
        while ((nl = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line) onLine(line);
        }
    });
}

function baseSession(runner) {
    let child = null;
    let stopping = false;

    return {
        send(prompt) {
            stopping = false;
            child = runner.start(prompt, () => stopping);

            let stderr = '';
            child.stderr.on('data', (c) => { stderr += c.toString(); });
            child.on('close', (code) => {
                if (stopping) runner.emit({ type: 'stopped' });
                else if (code !== 0 && stderr.trim()) runner.emit({ type: 'error', message: stderr.trim().slice(-600) });
                else runner.onClose?.(code);
                child = null;
            });
        },
        stop() {
            if (!child) return;
            stopping = true;
            killTree(child); // whole process tree (shell + CLI) on every OS
        },
    };
}

/* ---------------------------------------------------------------- claude */

function claudeSession({ model, cwd, emit }) {
    let sessionId = null;

    const runner = {
        emit,
        start(prompt, isStopping) {
            const args = [
                '-p',
                '--output-format', 'stream-json',
                '--verbose',
                '--permission-mode', 'acceptEdits',
                '--allowedTools', CLAUDE_ALLOWED_TOOLS,
            ];
            // Relative path on purpose: cwd is the app folder and the absolute
            // path contains a space ("NativeBlade Studio"). Only exists after
            // the scaffold — the planning run goes without MCP.
            if (existsSync(join(cwd, '.mcp.json'))) args.push('--mcp-config', '.mcp.json');
            if (model) args.push('--model', model);
            if (sessionId) args.push('--resume', sessionId);

            const child = spawnCli('claude', args, cwd);
            child.stdin.write(prompt);
            child.stdin.end();

            lineReader(child, (line) => {
                let evt;
                try { evt = JSON.parse(line); } catch { return; }
                if (evt.session_id) sessionId = evt.session_id;

                if (evt.type === 'assistant') {
                    for (const block of evt.message?.content ?? []) {
                        if (block.type === 'text' && block.text.trim()) emit({ type: 'text', text: block.text });
                        if (block.type === 'tool_use') emit({ type: 'tool', name: block.name, ...claudeTool(block) });
                    }
                }
                if (evt.type === 'result' && !isStopping()) {
                    emit(evt.is_error
                        ? { type: 'error', message: evt.result || 'The AI run failed.' }
                        : { type: 'done' });
                }
            });
            return child;
        },
    };
    return baseSession(runner);
}

function claudeTool(block) {
    const input = block.input ?? {};
    const file = input.file_path ?? input.path ?? '';
    const base = file ? String(file).split(/[\\/]/).pop() : '';
    switch (block.name) {
        case 'Write':
        case 'Edit': return { label: base ? `Writing ${base}` : 'Writing code', detail: null };
        case 'Read': return { label: base ? `Reading ${base}` : 'Reading the project', detail: null };
        case 'Bash': return { label: input.description || 'Running command', detail: String(input.command ?? '').slice(0, 220) || null };
        case 'Glob':
        case 'Grep': return { label: 'Searching the project', detail: null };
        case 'TodoWrite': return { label: 'Updating the build checklist', detail: null };
        default: return { label: 'Working', detail: null };
    }
}

/* ----------------------------------------------------------------- codex */

function codexSession({ model, cwd, emit }) {
    let threadId = null;

    const runner = {
        emit,
        start(prompt, isStopping) {
            // `codex exec -` reads the prompt from stdin; --json emits JSONL.
            // --dangerously-bypass-approvals-and-sandbox is REQUIRED, not just
            // convenient: in headless exec, stdin is closed, so any MCP tool
            // call that would prompt for approval is auto-cancelled ("user
            // cancelled MCP tool call") — and under the workspace-write sandbox
            // MCP calls fail anyway. Bypass is currently the only way to let
            // the AI use the NativeBlade MCP (Codex issues #24135 / #16685).
            // It matches Claude Code's acceptEdits trust level here: BYO CLI,
            // building the user's own app on their own machine.
            const args = [
                'exec', '-', '--json', '--skip-git-repo-check',
                '--dangerously-bypass-approvals-and-sandbox',
            ];
            if (model) args.push('-m', model);
            if (threadId) args.splice(1, 0, 'resume', threadId); // codex exec resume <id> -

            const child = spawnCli('codex', args, cwd);
            child.stdin.write(prompt);
            child.stdin.end();

            let sawMessage = false;
            lineReader(child, (line) => {
                let evt;
                try { evt = JSON.parse(line); } catch { return; }
                if (evt.thread_id) threadId = evt.thread_id;
                if (evt.type === 'item.completed' && evt.item) {
                    const it = evt.item;
                    if (it.type === 'agent_message' && it.text?.trim()) { sawMessage = true; emit({ type: 'text', text: it.text }); }
                    if (it.type === 'command_execution') emit({ type: 'tool', name: 'command', label: 'Running command', detail: String(it.command ?? '').slice(0, 220) || null });
                    if (it.type === 'file_change') emit({ type: 'tool', name: 'file', label: 'Writing code', detail: null });
                }
                if (evt.type === 'turn.completed' && !isStopping()) emit({ type: 'done' });
                if (evt.type === 'turn.failed' && !isStopping()) emit({ type: 'error', message: evt.error?.message || 'The AI run failed.' });
            });
            void sawMessage;
            return child;
        },
    };
    return baseSession(runner);
}

/* ------------------------------------------------------------------ grok */

/**
 * Grok Build (`grok`). Verified schema of `--output-format streaming-json`:
 *   {type:'thought', data}  — reasoning tokens (ignored)
 *   {type:'text',    data}  — the answer, streamed in fragments (accumulated)
 *   {type:'end', stopReason, sessionId} — terminal; sessionId powers --resume
 * The prompt goes through --prompt-file (a temp file), never stdin (Grok's -p
 * takes the prompt as a value, not stdin) and never an inline arg (spawnCli runs
 * with shell:true, so multi-line/quoted text would break the command line).
 * bypassPermissions matches Claude's acceptEdits / Codex's bypass trust level:
 * a BYO CLI building the user's own app on their own machine.
 */
function grokSession({ model, cwd, emit }) {
    let sessionId = null; // captured from `end` → --resume keeps the thread alive

    const runner = {
        emit,
        start(prompt, isStopping) {
            const args = ['--output-format', 'streaming-json', '--permission-mode', 'bypassPermissions'];
            if (model) args.push('-m', model);
            if (sessionId) args.push('--resume', sessionId);

            const promptFile = join(tmpdir(), `nb-grok-${randomUUID()}.txt`);
            writeFileSync(promptFile, prompt);
            args.push('--prompt-file', promptFile);

            const child = spawnCli('grok', args, cwd);
            child.on('close', () => { try { unlinkSync(promptFile); } catch { /* already gone */ } });

            let answer = ''; // 'text' fragments concatenate into the final reply
            let ended = false;
            let thinking = false; // one "Thinking…" line per reasoning stretch
            lineReader(child, (line) => {
                let evt;
                try { evt = JSON.parse(line); } catch { return; }
                if (evt.type === 'thought') {
                    // Reasoning tokens aren't shown, but Grok can think for a while
                    // before its first command — surface one "Thinking…" line so the
                    // progress group moves instead of looking frozen on the last step.
                    if (!thinking) { thinking = true; emit({ type: 'tool', name: 'grok', label: 'Thinking…', detail: null }); }
                    return;
                }
                if (evt.type === 'text') { thinking = false; if (typeof evt.data === 'string') answer += evt.data; return; }
                if (evt.type === 'error') {
                    if (!ended && !isStopping()) { ended = true; emit({ type: 'error', message: grokErrMsg(evt) }); }
                    return;
                }
                if (evt.type === 'end') {
                    if (evt.sessionId) sessionId = evt.sessionId;
                    if (!ended && !isStopping()) {
                        ended = true;
                        if (answer.trim()) emit({ type: 'text', text: answer });
                        emit({ type: 'done' });
                    }
                    return;
                }
                // Anything else is tool/command/file activity — show it if we can.
                const tool = grokTool(evt);
                if (tool) { thinking = false; emit({ type: 'tool', name: 'grok', ...tool }); }
            });

            // Fallback: process died without an `end`/`error` event — still flush
            // whatever answer we have and close the turn.
            runner.onClose = () => {
                if (ended) return;
                if (answer.trim()) emit({ type: 'text', text: answer });
                emit({ type: 'done' });
            };
            return child;
        },
    };
    return baseSession(runner);
}

// Map an unrecognized Grok event to a chain-of-thought tool line, or null. The
// tool event schema isn't confirmed yet, so this stays tolerant; a miss just
// means no detail line, never a broken turn.
function grokTool(evt) {
    if (!evt || typeof evt !== 'object') return null;
    const type = String(evt.type ?? '');
    const cmd = evt.command ?? evt.data?.command ?? evt.input?.command;
    if (typeof cmd === 'string' && cmd.trim()) return { label: 'Running command', detail: cmd.slice(0, 220) };
    const file = evt.path ?? evt.file ?? evt.file_path ?? evt.data?.path ?? evt.input?.file_path;
    if (typeof file === 'string' && file) return { label: `Writing ${String(file).split(/[\\/]/).pop()}`, detail: null };
    if (/tool|command|exec|bash|shell/i.test(type)) return { label: 'Working', detail: null };
    if (/file|edit|write|patch/i.test(type)) return { label: 'Writing code', detail: null };
    return null;
}

function grokErrMsg(evt) {
    const m = evt.error?.message ?? evt.message ?? evt.data ?? evt.error;
    return typeof m === 'string' && m.trim() ? m.slice(-600) : 'The AI run failed.';
}
