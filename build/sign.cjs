const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Windows code signing via SSL.com CodeSignTool. Invoked by electron-builder
// (win.signtoolOptions.sign) for each artifact. Skips cleanly when the SSL
// credentials aren't present (e.g. local builds), so `electron-builder --win`
// still produces an unsigned installer instead of failing.
exports.default = async function sign(configuration) {
  const filePath = configuration.path;
  if (!filePath) return;

  const {
    SSL_USERNAME,
    SSL_PASSWORD,
    SSL_CREDENTIAL_ID,
    SSL_TOTP_SECRET,
    CODE_SIGN_TOOL_PATH,
  } = process.env;

  if (!SSL_USERNAME || !SSL_PASSWORD || !SSL_CREDENTIAL_ID || !SSL_TOTP_SECRET) {
    console.log(`[sign] Skipping (SSL credentials not set): ${filePath}`);
    return;
  }

  if (!CODE_SIGN_TOOL_PATH || !fs.existsSync(CODE_SIGN_TOOL_PATH)) {
    throw new Error(`CODE_SIGN_TOOL_PATH is not set or does not exist: ${CODE_SIGN_TOOL_PATH}`);
  }

  const tool = path.join(CODE_SIGN_TOOL_PATH, 'CodeSignTool.bat');
  const outDir = path.join(path.dirname(filePath), '.signed');
  fs.mkdirSync(outDir, { recursive: true });

  const args = [
    'sign',
    `-username="${SSL_USERNAME}"`,
    `-password="${SSL_PASSWORD}"`,
    `-credential_id="${SSL_CREDENTIAL_ID}"`,
    `-totp_secret="${SSL_TOTP_SECRET}"`,
    `-input_file_path="${filePath}"`,
    `-output_dir_path="${outDir}"`,
  ].join(' ');

  console.log(`[sign] Signing ${path.basename(filePath)}`);
  execSync(`"${tool}" ${args}`, { stdio: 'inherit', cwd: CODE_SIGN_TOOL_PATH });

  const signed = path.join(outDir, path.basename(filePath));
  fs.copyFileSync(signed, filePath);
  fs.rmSync(outDir, { recursive: true, force: true });
};
