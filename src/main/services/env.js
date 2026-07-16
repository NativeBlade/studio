import { execFile } from 'child_process';
import os from 'os';
import { ollamaVersion } from './ollama.js';

/**
 * Hidden environment doctor: detects the OS, the NativeBlade toolchain
 * (PHP >= 8.3, Composer, Node >= 20, git) and which AI CLIs are installed
 * (Claude Code, Codex, Grok Build, Ollama), with per-OS install guidance for whatever
 * is missing. The user never sees this as a screen — the toolchain report goes
 * to the AI via the context files, and only the AI engines surface in setup.
 */

const MIN = { php: [8, 3], node: [20, 0], composer: [2, 0], git: [2, 0], claude: [1, 0], codex: [0, 1], grok: [0, 1], ollama: [0, 1] };

function run(cmd, args) {
    return new Promise((resolve) => {
        execFile(cmd, args, { shell: true, timeout: 10_000, windowsHide: true }, (err, stdout) => {
            resolve(err ? null : String(stdout));
        });
    });
}

function parseVersion(output, pattern) {
    const m = (output || '').match(pattern);
    return m ? m[1] : null;
}

function meets(version, [major, minor]) {
    if (!version) return false;
    const [a, b = 0] = version.split('.').map(Number);
    return a > major || (a === major && b >= minor);
}

const HINTS = {
    win32: {
        php: { label: 'Install PHP 8.5 (winget)', cmd: 'winget install PHP.PHP.8.5', url: 'https://windows.php.net/download' },
        composer: { label: 'Install Composer', cmd: 'winget install Composer.Composer', url: 'https://getcomposer.org/download/' },
        node: { label: 'Install Node.js 20+', cmd: 'winget install OpenJS.NodeJS.LTS', url: 'https://nodejs.org' },
        git: { label: 'Install Git', cmd: 'winget install Git.Git', url: 'https://git-scm.com/downloads' },
    },
    darwin: {
        php: { label: 'Install PHP (Homebrew)', cmd: 'brew install php', url: 'https://brew.sh' },
        composer: { label: 'Install Composer', cmd: 'brew install composer', url: 'https://getcomposer.org/download/' },
        node: { label: 'Install Node.js 20+', cmd: 'brew install node@20', url: 'https://nodejs.org' },
        git: { label: 'Install Git', cmd: 'xcode-select --install', url: 'https://git-scm.com/downloads' },
    },
    linux: {
        php: { label: 'Install PHP 8.5 (ondrej PPA)', cmd: 'sudo add-apt-repository ppa:ondrej/php && sudo apt install php8.5-cli php8.5-mbstring php8.5-xml php8.5-curl php8.5-zip php8.5-gd php8.5-sqlite3 php8.5-intl', url: 'https://deb.sury.org' },
        composer: { label: 'Install Composer', cmd: "curl -fsSL https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer", url: 'https://getcomposer.org/download/' },
        node: { label: 'Install Node.js 20+', cmd: 'curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt install nodejs', url: 'https://nodejs.org' },
        git: { label: 'Install Git', cmd: 'sudo apt install git', url: 'https://git-scm.com/downloads' },
    },
};

// Claude and Codex install the same way on every OS (npm). Grok Build ships a
// per-OS shell installer, so its hint is picked by platform below.
const AI_HINTS = {
    claude: { label: 'Install Claude Code', cmd: 'npm install -g @anthropic-ai/claude-code', url: 'https://claude.com/claude-code' },
    codex: { label: 'Install Codex CLI', cmd: 'npm install -g @openai/codex', url: 'https://developers.openai.com/codex/cli' },
};

export async function checkEnvironment() {
    const platform = process.platform; // win32 | darwin | linux
    const hints = HINTS[platform] ?? HINTS.linux;

    const grokHint = platform === 'win32'
        ? { label: 'Install Grok Build', cmd: 'irm https://x.ai/cli/install.ps1 | iex', url: 'https://docs.x.ai/build' }
        : { label: 'Install Grok Build', cmd: 'curl -fsSL https://x.ai/cli/install.sh | bash', url: 'https://docs.x.ai/build' };

    const ollamaHint = {
        win32: { label: 'Install Ollama', cmd: 'winget install Ollama.Ollama', url: 'https://ollama.com/download' },
        darwin: { label: 'Install Ollama', cmd: 'brew install ollama', url: 'https://ollama.com/download' },
        linux: { label: 'Install Ollama', cmd: 'curl -fsSL https://ollama.com/install.sh | sh', url: 'https://ollama.com/download' },
    }[platform] ?? { label: 'Install Ollama', cmd: 'curl -fsSL https://ollama.com/install.sh | sh', url: 'https://ollama.com/download' };

    const [php, composer, node, git, claude, codex, grok, ollamaVer] = await Promise.all([
        run('php', ['-v']),
        run('composer', ['--version']),
        run('node', ['-v']),
        run('git', ['--version']),
        run('claude', ['--version']),
        run('codex', ['--version']),
        run('grok', ['--version']),
        ollamaVersion(), // the daemon over HTTP — its CLI is often off PATH
    ]);

    const checks = [
        { id: 'php', name: 'PHP', version: parseVersion(php, /PHP (\d+\.\d+\.\d+)/), required: '>= 8.3 (8.5 recommended)', hint: hints.php },
        { id: 'composer', name: 'Composer', version: parseVersion(composer, /Composer(?: version)? (\d+\.\d+\.\d+)/), required: '>= 2.0', hint: hints.composer },
        { id: 'node', name: 'Node.js', version: parseVersion(node, /v(\d+\.\d+\.\d+)/), required: '>= 20', hint: hints.node },
        { id: 'git', name: 'Git', version: parseVersion(git, /git version (\d+\.\d+[\.\d]*)/), required: '>= 2 (powers rollback checkpoints)', hint: hints.git },
        { id: 'claude', name: 'Claude Code', version: parseVersion(claude, /(\d+\.\d+\.\d+)/), required: 'any recent version', hint: AI_HINTS.claude },
        { id: 'codex', name: 'Codex CLI', version: parseVersion(codex, /(\d+\.\d+\.\d+)/), required: 'any recent version', hint: AI_HINTS.codex },
        { id: 'grok', name: 'Grok Build', version: parseVersion(grok, /(\d+\.\d+(?:\.\d+)?)/), required: 'any recent version', hint: grokHint },
        { id: 'ollama', name: 'Ollama (local)', version: ollamaVer, required: 'running daemon + Codex CLI', hint: ollamaHint },
    ].map((c) => ({ ...c, ok: meets(c.version, MIN[c.id]) }));

    // Ollama has no agent of its own — Codex drives the local model via --oss,
    // so the engine only works when BOTH are installed. If Ollama is there but
    // Codex isn't, point the user at the piece that's actually missing.
    const codexOk = checks.find((c) => c.id === 'codex').ok;
    const ollamaCheck = checks.find((c) => c.id === 'ollama');
    if (ollamaCheck.ok && !codexOk) Object.assign(ollamaCheck, { ok: false, hint: AI_HINTS.codex });

    return {
        platform,
        platformLabel: { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[platform] ?? platform,
        arch: os.arch(),
        checks,
    };
}
