const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '../data/db');
if (!fs.existsSync(dbPath)) {
  fs.mkdirSync(dbPath, { recursive: true });
}

// Find mongod binary
const candidates = [
  '/usr/bin/mongod',
  '/usr/local/bin/mongod',
  '/home/mhkxuz/.cache/mongodb-binaries/mongod-x64-arch-7.0.24'
];

let mongodBin = candidates.find(bin => fs.existsSync(bin));

if (!mongodBin) {
  console.error('[Error] mongod binary not found in system or cache.');
  process.exit(1);
}

console.log(`[Persistent DB] Starting MongoDB from: ${mongodBin}`);
console.log(`[Persistent DB] Data directory: ${dbPath}`);
console.log(`[Persistent DB] Port: 27017`);

const child = spawn(
  mongodBin,
  ['--dbpath', dbPath, '--port', '27017', '--bind_ip', '127.0.0.1'],
  { stdio: 'inherit' }
);

child.on('error', err => {
  console.error('[Persistent DB] Error starting MongoDB:', err);
});

child.on('exit', (code, signal) => {
  console.log(`[Persistent DB] MongoDB process exited with code ${code} (${signal})`);
});

process.on('SIGINT', () => {
  console.log('[Persistent DB] Stopping MongoDB...');
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('[Persistent DB] Stopping MongoDB...');
  child.kill('SIGTERM');
});
