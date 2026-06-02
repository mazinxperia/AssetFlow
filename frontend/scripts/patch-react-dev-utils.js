const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  'react-dev-utils',
  'checkRequiredFiles.js'
);

if (!fs.existsSync(target)) {
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
const patched = source.replace(/\bfs\.F_OK\b/g, 'fs.constants.F_OK');

if (patched !== source) {
  fs.writeFileSync(target, patched);
}
