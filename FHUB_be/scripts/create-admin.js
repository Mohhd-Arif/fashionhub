require('../config/env');
const readline = require('node:readline/promises');
const { connectDatabase, closeDatabase, connectionErrorMessage } = require('../config/database');
const { ensureIndexes } = require('../config/indexes');
const { email, password, ApiError } = require('../service/validation');
const { hashPassword } = require('../service/auth');

async function secretQuestion() {
  if (!process.stdin.isTTY) throw new ApiError(400, 'Run this command in an interactive terminal, or supply ADMIN_PASSWORD via your environment.');
  process.stdout.write('Admin password (8+ characters, hidden): ');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let value = '';
    const finish = () => { process.stdin.off('data', handler); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); };
    function handler(chunk) {
      for (const char of chunk) {
        if (char === '\u0003') { finish(); reject(new ApiError(400, 'Cancelled.')); return; }
        if (char === '\r' || char === '\n') { finish(); resolve(value); return; }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ') value += char;
      }
    }
    process.stdin.on('data', handler);
  });
}
(async () => {
  try {
    let address = process.argv[2] || process.env.ADMIN_EMAIL;
    if (!address) {
      const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
      address = await prompt.question('Admin email: ');
      prompt.close();
    }
    address = email(address);
    const secret = password(process.env.ADMIN_PASSWORD || await secretQuestion());
    const db = await connectDatabase();
    await ensureIndexes(db);
    await db.collection('users').insertOne({ email: address, passwordHash: await hashPassword(secret), usertype: 'admin', createdAt: new Date() });
    console.log('Admin account created. Sign in at http://localhost:5173/admin');
  } catch (error) {
    console.error(error.code === 11000 ? 'That email already exists. No role or password was changed.' : error instanceof ApiError ? error.message : connectionErrorMessage(error));
    process.exitCode = 1;
  } finally { await closeDatabase(); }
})();
