// Guards against references to theme tokens that no longer exist. A stale
// token (e.g. `colors.gold.muted` after the role-based rename) evaluates to
// `undefined.muted` inside StyleSheet.create, which throws at module load and
// takes down every screen that imports the component — this has caused real
// production-build crashes. Scans every source file that imports the theme.
const fs = require('fs');
const path = require('path');
const { colors, typography, spacing } = require('../styles/theme');

const ROOT = path.join(__dirname, '..');
const SCAN_DIRS = ['app', 'components', 'lib', 'contexts', 'hooks'];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.jsx?$/.test(entry.name)) files.push(full);
  }
  return files;
}

const themeFiles = SCAN_DIRS.flatMap((d) => walk(path.join(ROOT, d))).filter((f) =>
  /from\s+['"][^'"]*styles\/theme['"]/.test(fs.readFileSync(f, 'utf8'))
);

test('theme is imported somewhere (scan is not vacuous)', () => {
  expect(themeFiles.length).toBeGreaterThan(0);
});

test.each(themeFiles.map((f) => [path.relative(ROOT, f)]))(
  '%s only references theme tokens that exist',
  (rel) => {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const bad = [];
    for (const [name, obj] of [
      ['colors', colors],
      ['typography', typography],
      ['spacing', spacing],
    ]) {
      const re = new RegExp(`\\b${name}\\.([A-Za-z_$][\\w$]*)(?:\\.([A-Za-z_$][\\w$]*))?`, 'g');
      let m;
      while ((m = re.exec(src)) !== null) {
        const [, first, second] = m;
        if (!(first in obj)) bad.push(`${name}.${first}`);
        else if (second && obj[first] != null && typeof obj[first] === 'object' && !(second in obj[first]))
          bad.push(`${name}.${first}.${second}`);
      }
    }
    expect(bad).toEqual([]);
  }
);
