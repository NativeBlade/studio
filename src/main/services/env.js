import { execFile } from 'child_process';
import os from 'os';

/**
 * Hidden environment doctor: detects the OS, the NativeBlade toolchain
 * (PHP >= 8.3, Composer, Node >= 20, git) and which AI CLIs are installed
 * (Claude Code, Codex, Gemini), with per-OS install guidance for whatever is
 * missing. The user never sees this as a screen — the toolchain report goes
 * to the AI via the context files, and only the AI engines surface in setup.
 */

const MIN = { php: [8, 3], node: [20, 0], composer: [2, 0], git: [2, 0], claude: [1, 0], codex: [0, 1], gemini: [0, 1] };

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

// The AI engines install the same way on every OS (npm).
const AI_HINTS = {
    claude: { label: 'Install Claude Code', cmd: 'npm install -g @anthropic-ai/claude-code', url: 'https://claude.com/claude-code' },
    codex: { label: 'Install Codex CLI', cmd: 'npm install -g @openai/codex', url: 'https://developers.openai.com/codex/cli' },
    gemini: { label: 'Install Gemini CLI', cmd: 'npm install -g @google/gemini-cli', url: 'https://github.com/google-gemini/gemini-cli' },
};

export async function checkEnvironment() {
    const platform = process.platform; // win32 | darwin | linux
    const hints = HINTS[platform] ?? HINTS.linux;

    const [php, composer, node, git, claude, codex, gemini] = await Promise.all([
        run('php', ['-v']),
        run('composer', ['--version']),
        run('node', ['-v']),
        run('git', ['--version']),
        run('claude', ['--version']),
        run('codex', ['--version']),
        run('gemini', ['--version']),
    ]);

    const checks = [
        { id: 'php', name: 'PHP', version: parseVersion(php, /PHP (\d+\.\d+\.\d+)/), required: '>= 8.3 (8.5 recommended)', hint: hints.php },
        { id: 'composer', name: 'Composer', version: parseVersion(composer, /Composer(?: version)? (\d+\.\d+\.\d+)/), required: '>= 2.0', hint: hints.composer },
        { id: 'node', name: 'Node.js', version: parseVersion(node, /v(\d+\.\d+\.\d+)/), required: '>= 20', hint: hints.node },
        { id: 'git', name: 'Git', version: parseVersion(git, /git version (\d+\.\d+[\.\d]*)/), required: '>= 2 (powers rollback checkpoints)', hint: hints.git },
        { id: 'claude', name: 'Claude Code', version: parseVersion(claude, /(\d+\.\d+\.\d+)/), required: 'any recent version', hint: AI_HINTS.claude },
        { id: 'codex', name: 'Codex CLI', version: parseVersion(codex, /(\d+\.\d+\.\d+)/), required: 'any recent version', hint: AI_HINTS.codex },
        { id: 'gemini', name: 'Gemini CLI', version: parseVersion(gemini, /(\d+\.\d+\.\d+)/), required: 'any recent version', hint: AI_HINTS.gemini },
    ].map((c) => ({ ...c, ok: meets(c.version, MIN[c.id]) }));

    return {
        platform,
        platformLabel: { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[platform] ?? platform,
        arch: os.arch(),
        checks,
    };
}
