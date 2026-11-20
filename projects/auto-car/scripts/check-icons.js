const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const ids = new Set([...html.matchAll(/id="i-([a-z0-9-]+)"/g)].map((m) => m[1]));
const used = new Set();
const dir = path.join(__dirname, '..', 'public', 'assets', 'js');
function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (f.name.endsWith('.js')) {
      const s = fs.readFileSync(p, 'utf8');
      for (const m of s.matchAll(/icon\(\s*['"]([a-z0-9-]+)['"]/g)) used.add(m[1]);
    }
  }
}
walk(dir);
const missing = [...used].filter((x) => !ids.has(x)).sort();
console.log('sprite ids:', ids.size);
console.log('used:', used.size);
console.log('MISSING:', missing.join(', ') || '(none)');
