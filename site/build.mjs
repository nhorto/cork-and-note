// site/build.mjs — generates the Cork & Note marketing + legal site into site/dist.
//
// Zero dependencies on purpose: Vercel skips `npm install` for this project
// (see vercel.json), so a deploy is a few hundred milliseconds instead of
// installing the whole Expo/React Native tree for a static site.
//
// The legal pages are generated from lib/legalContent.js — the SAME module the
// in-app screens render — so the hosted policy and the one inside the app can
// never drift. lib/ is ESM in a CommonJS package, so it's loaded through a
// data: URL import rather than require().
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site', 'dist');

const legalSrc = readFileSync(join(ROOT, 'lib', 'legalContent.js'), 'utf8');
const { PRIVACY_POLICY, TERMS_OF_USE } = await import(
  'data:text/javascript;base64,' + Buffer.from(legalSrc).toString('base64')
);

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const YEAR = new Date().getFullYear();

function page({ title, description, main, active = '' }) {
  const nav = [
    ['/', 'Home'],
    ['/privacy', 'Privacy'],
    ['/terms', 'Terms'],
    ['/support', 'Support'],
  ]
    .map(
      ([href, label]) =>
        `<a href="${href}"${active === href ? ' aria-current="page"' : ''}>${label}</a>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="/styles.css">
</head>
<body>
<header class="bar">
  <a class="wordmark" href="/">Cork&nbsp;&amp;&nbsp;Note</a>
  <nav>${nav}</nav>
</header>
<main>
${main}
</main>
<footer>
  <div class="rule" role="presentation"></div>
  <p>&copy; ${YEAR} Cork &amp; Note. All rights reserved.</p>
  <p class="links"><a href="/privacy">Privacy policy</a> · <a href="/terms">Terms of use</a> · <a href="/support">Support</a></p>
</footer>
</body>
</html>
`;
}

function legalPage(doc, active) {
  const body = doc.sections
    .map(
      (s) =>
        `<section><h2>${esc(s.heading)}</h2>${s.paragraphs
          .map((p) => `<p>${esc(p)}</p>`)
          .join('')}</section>`
    )
    .join('\n');
  return page({
    title: `${doc.title} · Cork & Note`,
    description: `${doc.title} for Cork & Note, the wine tasting journal.`,
    active,
    main: `<article class="prose">
  <h1>${esc(doc.title)}</h1>
  <p class="updated">Last updated: ${esc(doc.updated)}</p>
  ${body}
</article>`,
  });
}

const FEATURES = [
  ['Log the tasting room', 'Capture every wine you taste — ratings, flavour notes, photos — with or without a place attached.'],
  ['Scan a label', 'Point your camera at a bottle or a tasting card and let it fill in the details for you.'],
  ['See where you have been', 'Every winery you have visited, on a map and in a list, with your notes from each visit.'],
  ['Keep a cellar', 'Track the bottles you own, with drink windows that tell you what is ready tonight.'],
  ['Ask a sommelier', 'A wine companion that knows what you actually liked, because it has read your own notes.'],
];

const home = page({
  title: 'Cork & Note — the wine journal for people who visit wineries',
  description:
    'Log the tasting room, remember every wine, and ask a sommelier who knows what you actually liked.',
  active: '/',
  main: `<section class="hero">
  <p class="eyebrow">Wine tasting journal</p>
  <h1>Remember every wine you taste.</h1>
  <p class="lede">The wine journal for people who visit wineries. Log the tasting room, remember every wine, and ask a sommelier who knows what you actually liked.</p>
  <p class="badge">Coming soon to the App&nbsp;Store</p>
</section>

<div class="rule" role="presentation"></div>

<section class="features">
  ${FEATURES.map(
    ([h, p]) => `<div class="feature"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`
  ).join('\n  ')}
</section>`,
});

const support = page({
  title: 'Support · Cork & Note',
  description: 'Get help with Cork & Note.',
  active: '/support',
  main: `<article class="prose">
  <h1>Support</h1>
  <p>We read everything that comes in and try to reply within a few days.</p>

  <section>
    <h2>Get in touch</h2>
    <p>The fastest way to reach us is from inside the app: open <strong>Profile → Feedback</strong>. That form sends us your message along with your app version, which usually saves a round trip.</p>
    <p>You can also report a bug the same way — choose the bug option and describe what you were doing when it happened.</p>
  </section>

  <section>
    <h2>Common questions</h2>
    <p><strong>How do I find the wines I have logged?</strong> Open <strong>Profile → Your tastings</strong>, or tap the “Wines tasted” tile on Home. Places you have visited live under <strong>Profile → Your places</strong>.</p>
    <p><strong>How do I delete my account?</strong> Open <strong>Profile → Account settings → Delete account</strong>. This permanently removes your account and all of its data — journal entries, photos, cellar and chat history. It cannot be undone.</p>
    <p><strong>Is the sommelier always right?</strong> No. It is an AI assistant and it can be wrong about wine facts, pairings and drink windows. Treat it as a knowledgeable friend, not an authority — and please drink responsibly.</p>
  </section>

  <section>
    <h2>Privacy</h2>
    <p>Our <a href="/privacy">privacy policy</a> explains exactly what we collect and who we share it with, including what happens when you talk to the sommelier.</p>
  </section>
</article>`,
});

const css = `:root{
  --burgundy:#722F37; --wine:#8B1A1A; --gold:#C9A962; --gold-muted:#D4C4A8;
  --gold-text:#7E6430; --cream:#FAF8F5; --parchment:#F5F2ED; --stone:#D8D2C8;
  --charcoal:#2C2C2C; --graphite:#4A4A4A; --pewter:#6E6E6E;
  --serif:Georgia,'Times New Roman',serif;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
body{margin:0;background:var(--cream);color:var(--charcoal);font-family:var(--sans);
  font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
main{max-width:760px;margin:0 auto;padding:0 24px}
a{color:var(--burgundy)}
a:hover{color:var(--wine)}

.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
  max-width:760px;margin:0 auto;padding:24px}
.wordmark{font-family:var(--serif);font-size:22px;font-weight:600;letter-spacing:.5px;
  color:var(--burgundy);text-decoration:none}
.bar nav{display:flex;gap:20px}
.bar nav a{font-size:15px;color:var(--graphite);text-decoration:none}
.bar nav a:hover,.bar nav a[aria-current]{color:var(--burgundy)}

.rule{height:1px;background:linear-gradient(to right,transparent,var(--gold-muted),transparent);
  margin:40px 0}

.hero{padding:32px 0 8px}
.eyebrow{font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold-text);margin:0 0 12px}
.hero h1{font-family:var(--serif);font-size:44px;line-height:1.15;margin:0 0 16px;color:var(--charcoal)}
.lede{font-size:19px;color:var(--graphite);margin:0 0 28px;max-width:60ch}
.badge{display:inline-block;background:var(--burgundy);color:var(--cream);
  padding:12px 22px;border-radius:999px;font-size:15px;font-weight:600;margin:0}

.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;padding-bottom:16px}
.feature{background:var(--parchment);border:1px solid var(--stone);border-radius:12px;padding:20px}
.feature h3{font-family:var(--serif);font-size:19px;margin:0 0 8px;color:var(--burgundy)}
.feature p{margin:0;font-size:15px;color:var(--graphite)}

.prose{padding:16px 0 8px}
.prose h1{font-family:var(--serif);font-size:36px;margin:0 0 8px}
.prose h2{font-family:var(--serif);font-size:22px;margin:32px 0 10px;color:var(--burgundy)}
.prose p{margin:0 0 12px;color:var(--graphite)}
.prose strong{color:var(--charcoal)}
.updated{font-size:14px;color:var(--pewter);margin-bottom:24px}

footer{max-width:760px;margin:0 auto;padding:0 24px 48px;text-align:center;
  font-size:14px;color:var(--pewter)}
footer p{margin:6px 0}
footer .links a{color:var(--pewter)}
footer .links a:hover{color:var(--burgundy)}

@media (max-width:600px){
  .hero h1{font-size:34px}
  .lede{font-size:17px}
  .prose h1{font-size:28px}
}
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const files = {
  'index.html': home,
  'privacy.html': legalPage(PRIVACY_POLICY, '/privacy'),
  'terms.html': legalPage(TERMS_OF_USE, '/terms'),
  'support.html': support,
  'styles.css': css,
};

for (const [name, contents] of Object.entries(files)) {
  writeFileSync(join(OUT, name), contents);
}
console.log(`Built ${Object.keys(files).length} files into site/dist`);
