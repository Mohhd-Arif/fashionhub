const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(backendRoot, '..');
const frontendRoot = path.join(repoRoot, 'FHUB_ui');
const frontendDist = path.join(frontendRoot, 'dist');
const backendDist = path.join(backendRoot, 'dist');

execSync('npm ci', { cwd: frontendRoot, stdio: 'inherit', shell: true });
execSync('npm run build', { cwd: frontendRoot, stdio: 'inherit', shell: true });
fs.rmSync(backendDist, { recursive: true, force: true });
fs.cpSync(frontendDist, backendDist, { recursive: true });
console.log(`Copied frontend build to ${backendDist}`);
