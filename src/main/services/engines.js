import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { register, killTree } from './child-registry.js';

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
            { id: 'gpt-5.1-codex-max', label: 'GPT-5.1 Codex Max' },
            { id: 'gpt-5.1-codex', label: 'GPT-5.1 Codex' },
        ],
    },
    gemini: {
        name: 'Gemini CLI',
        vendor: 'Google',
        loginHint: 'run `gemini` in a terminal once and sign in with Google',
        models: [
            { id: null, label: 'Default (recommended)' },
            { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro' },
            { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
        ],
    },
};

// Claude Code needs these to run composer/npm/artisan and edit files without
// pausing on tool prompts; conversational permission (asking the user in
// chat) is handled by the context-file instructions instead.
const CLAUDE_ALLOWED_TOOLS = 'Bash,Edit,Write,Read,Glob,Grep,WebFetch,WebSearch,TodoWrite,Task,NotebookEdit,mcp__nativeblade';

export function createSession({ engine = 'claude', model = null, cwd, emit }) {
    const make = { claude: claudeSession, codex: codexSession, gemini: geminiSession }[engine] ?? claudeSession;
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
            // `codex exec -` reads the prompt from stdin; --json emits JSONL
            // events; --full-auto = workspace-write sandbox without approvals.
            const args = ['exec', '-', '--json', '--full-auto', '--skip-git-repo-check'];
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

/* ---------------------------------------------------------------- gemini */

function geminiSession({ model, cwd, emit }) {
    const runner = {
        emit,
        start(prompt) {
            // v1 adapter: single JSON response, no live tool stream. --yolo
            // auto-approves tool calls so headless runs don't hang.
            const args = ['--yolo', '--output-format', 'json'];
            if (model) args.push('-m', model);

            const child = spawnCli('gemini', args, cwd);
            child.stdin.write(prompt);
            child.stdin.end();

            emit({ type: 'tool', name: 'gemini', label: 'Working (Gemini reports at the end of each run)', detail: null });

            let out = '';
            child.stdout.on('data', (c) => { out += c.toString(); });
            runner.onClose = () => {
                try {
                    const json = JSON.parse(out.slice(out.indexOf('{')));
                    const text = json.response ?? json.text ?? '';
                    if (text.trim()) emit({ type: 'text', text });
                    emit({ type: 'done' });
                } catch {
                    if (out.trim()) { emit({ type: 'text', text: out.trim().slice(-4000) }); emit({ type: 'done' }); }
                    else emit({ type: 'error', message: 'Gemini returned no output.' });
                }
            };
            return child;
        },
    };
    return baseSession(runner);
}
