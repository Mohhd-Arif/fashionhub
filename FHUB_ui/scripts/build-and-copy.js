import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(scriptDirectory, '..');
const projectRoot = path.resolve(frontendRoot, '..');
const backendRoot = path.join(projectRoot, 'FHUB_be');
const frontendDist = path.join(frontendRoot, 'dist');
const backendDist = path.join(backendRoot, 'dist');

if (path.dirname(backendDist) !== backendRoot || path.basename(backendDist) !== 'dist') {
  throw new Error(`Refusing to replace unexpected directory: ${backendDist}`);
}

if (!fs.existsSync(path.join(backendRoot, 'package.json'))) {
  throw new Error(`Backend folder was not found at ${backendRoot}`);
}

console.log('Building Fashion Hub frontend...');
execSync('npm run build', { cwd: frontendRoot, stdio: 'inherit', shell: true });

if (!fs.existsSync(path.join(frontendDist, 'index.html'))) {
  throw new Error(`Frontend build was not created at ${frontendDist}`);
}

fs.rmSync(backendDist, { recursive: true, force: true });
fs.cpSync(frontendDist, backendDist, { recursive: true });

console.log(`Frontend build copied to ${backendDist}`);
