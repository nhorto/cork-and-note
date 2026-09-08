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
//
// Images in site/assets/ are pre-downscaled copies (committed, since this build
// runs with no image tooling): screenshots from docs/marketing/screenshots/,
// logo from mockups/logo-round-3/ (placeholder until the final mark is chosen).
// Marketing copy mirrors docs/business/app-store-listing.md; the Free/Pro split
// mirrors docs/business/launch-plan-2026-09.md §4.2.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site', 'dist');
const SITE_URL = 'https://cork-and-note.vercel.app';

const legalSrc = readFileSync(join(ROOT, 'lib', 'legalContent.js'), 'utf8');
const { PRIVACY_POLICY, TERMS_OF_USE } = await import(
  'data:text/javascript;base64,' + Buffer.from(legalSrc).toString('base64')
);

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const YEAR = new Date().getFullYear();

function page({ title, description, main, active = '', extraHead = '' }) {
  const nav = [
    ['/#features', 'Features'],
    ['/#pricing', 'Pricing'],
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
<meta property="og:image" content="${SITE_URL}/assets/og-image.jpg">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#FAF8F5">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="stylesheet" href="/styles.css">
${extraHead}</head>
<body>
<header class="bar">
  <a class="brand" href="/">
    <img class="mark" src="/assets/logo.jpg" alt="" width="36" height="36">
    <span class="wordmark">Cork&nbsp;&amp;&nbsp;Note</span>
  </a>
  <nav>${nav}</nav>
</header>
<main>
${main}
</main>
<footer>
  <div class="rule" role="presentation"></div>
  <p class="responsibly">Cork &amp; Note is for people of legal drinking age. Please drink responsibly.</p>
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
    main: `<div class="wrap"><article class="prose">
  <h1>${esc(doc.title)}</h1>
  <p class="updated">Last updated: ${esc(doc.updated)}</p>
  ${body}
</article></div>`,
  });
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------

const phone = (src, alt, { eager = false } = {}) =>
  `<div class="phone"><img src="/assets/${src}" alt="${esc(alt)}" width="720" height="1564"${
    eager ? ' fetchpriority="high"' : ' loading="lazy"'
  }></div>`;

const FEATURE_ROWS = [
  {
    shot: 'shot-2-log-a-tasting.png',
    alt: 'Cork & Note screen for logging a wine, with a label-scan button and a rating form.',
    eyebrow: 'The journal',
    heading: 'Log the tasting room',
    body: 'Capture each wine while you’re still at the table — a rating, flavour notes, a photo, and how it made you feel. Tag the winery, the restaurant, or nowhere at all: a wine logged without a location still counts.',
    points: [
      'Scan the label or the tasting card, and the producer, vintage and grapes fill themselves in.',
      'Built for real tasting rooms — it tells you when you’re offline instead of pretending to save.',
    ],
  },
  {
    shot: 'shot-3-winery-visits.png',
    alt: 'A winery page in Cork & Note showing past visits and the wines tasted on each one.',
    eyebrow: 'The places',
    heading: 'Remember where you’ve been',
    body: 'Every winery keeps its own page: the visits you’ve made, the wines you poured on each one, and the notes you left behind. Walk back in two years later knowing exactly what you loved.',
    points: [
      'Your most-visited places and latest trips, right on Home.',
      'Restaurants and tasting bars count too — anywhere you drink wine.',
    ],
  },
  {
    shot: 'shot-4-explore-map.jpg',
    alt: 'The Explore map in Cork & Note with pins on the wineries you have visited.',
    eyebrow: 'The map',
    heading: 'See everywhere you’ve explored',
    body: 'Your wine country, pinned. The map fills in as you taste — every winery you’ve visited, every region you’ve worked through, and your next stop while you’re out there.',
    points: [
      'A living record of your wine travels, not a directory of everyone else’s.',
    ],
  },
  {
    shot: 'shot-5-sommelier.png',
    alt: 'The Cork & Note sommelier chat, with a Tonight’s Pick recommendation.',
    eyebrow: 'The sommelier',
    heading: 'Ask a sommelier who’s read your notes',
    body: 'An AI wine companion grounded in your own ratings — not the internet’s. Ask what to open with dinner, what to try next at the counter, or what that grape on the menu actually is. It knows what you liked, because it has read your journal.',
    points: [
      'Tonight’s Pick chooses from bottles you own that are ready to drink.',
      'Answers start from your palate, not a crowd score.',
    ],
  },
];

const featureRows = FEATURE_ROWS.map(
  (f, i) => `<div class="featrow${i % 2 ? ' flip' : ''}">
  <div class="feat-text">
    <p class="eyebrow">${esc(f.eyebrow)}</p>
    <h3>${esc(f.heading)}</h3>
    <p>${esc(f.body)}</p>
    <ul>${f.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  </div>
  <div class="feat-media">${phone(f.shot, f.alt)}</div>
</div>`
).join('\n');

const WHY_CARDS = [
  [
    'The bottle and the place',
    'Rating apps know the wine but not the trip. Passport apps stamp the visit but forget the wine. Cork & Note is the journal that keeps what you drank together with where you were.',
  ],
  [
    'A sommelier with your palate',
    'Other apps recommend from crowd scores. Cork & Note’s sommelier reasons from your own ratings, visits and cellar — advice that sounds like a friend who was there with you.',
  ],
  [
    'A journal, not a feed',
    'No followers, no public ratings, no performing. Your notes are private to you — a place to actually remember, and to learn what you like along the way.',
  ],
];

const FAQ = [
  [
    'When can I get it?',
    'Cork & Note is in the final stretch of App Store preparation and launches on iPhone soon. This page will link straight to the App Store the day it’s live.',
  ],
  [
    'Is my journal public?',
    'No. Cork & Note has no social feed and no public profiles. Your tastings, photos and cellar are private to your account, and you can delete the account — and everything in it — at any time.',
  ],
  [
    'Do I have to be at a winery to log a wine?',
    'Not at all. Tag a winery or a restaurant when you’re there, or log a Tuesday-night bottle with no place attached. A wine without a location still counts.',
  ],
  [
    'Does it work when the tasting room has no signal?',
    'Wine country and cell coverage are old enemies. Cork & Note tells you when you’re offline instead of pretending to save, so you never lose a note you thought you took.',
  ],
  [
    'What about Android?',
    'Cork & Note launches on iPhone first. Android will follow if enough people ask for it — tell us on the support page.',
  ],
];

const home = page({
  title: 'Cork & Note — the wine journal for people who visit wineries',
  description:
    'Your tasting-room memory. Log every wine, remember where you had it, and ask a sommelier who has actually read your notes. Coming soon to the App Store.',
  active: '/',
  extraHead: `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Cork & Note: Wine Journal',
    operatingSystem: 'iOS',
    applicationCategory: 'LifestyleApplication',
    description:
      'Your tasting-room memory. Log every wine, remember where you had it, and ask a sommelier who has actually read your notes.',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  })}</script>
`,
  main: `<section class="hero wide">
  <div class="hero-text">
    <p class="eyebrow">A wine tasting journal for iPhone</p>
    <h1>Remember every wine you taste.</h1>
    <p class="lede">Cork &amp; Note is the wine journal for people who actually go to wineries. Log the tasting room, keep every place you’ve been, and ask a sommelier who has read your notes.</p>
    <p class="badge">Coming soon to the App&nbsp;Store</p>
    <p class="subnote">Free to download · iOS</p>
  </div>
  <div class="hero-media">${phone('shot-1-home.png', 'The Cork & Note home screen: wines tasted, places visited, Tonight’s Pick and bottles ready to drink.', { eager: true })}</div>
</section>

<section class="pain">
  <div class="wrap">
    <div class="double-rule" role="presentation"></div>
    <p class="pain-line">You taste six wines in an afternoon, love the third one, and by the next weekend you can’t remember its name.</p>
    <p class="pain-fix">Cork &amp; Note fixes that.</p>
    <div class="double-rule" role="presentation"></div>
  </div>
</section>

<section id="features" class="features wide">
  ${featureRows}
</section>

<section class="cellar-band">
  <div class="wrap">
    <p class="eyebrow">The cellar</p>
    <h2>A cellar that tells you when</h2>
    <p class="band-lede">Track the bottles you own with drink windows that say what’s ready now, what needs holding, and what to open tonight before it slips past its peak.</p>
    <div class="windows" role="presentation">
      <span class="chip ready">Ready tonight</span>
      <span class="chip soon">Drink soon</span>
      <span class="chip young">Too young</span>
      <span class="chip past">Past peak</span>
    </div>
  </div>
</section>

<section class="why wide">
  <p class="eyebrow centered">Why Cork &amp; Note</p>
  <h2 class="centered">Wine apps make you choose: rate bottles, or track trips.</h2>
  <p class="band-lede centered">Cork &amp; Note keeps the whole story in one place — and hands it to a sommelier.</p>
  <div class="cards">
    ${WHY_CARDS.map(
      ([h, p]) => `<div class="card"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`
    ).join('\n    ')}
  </div>
</section>

<section id="pricing" class="pricing wide">
  <p class="eyebrow centered">Pricing at launch</p>
  <h2 class="centered">Start free. Go Pro for the sommelier.</h2>
  <div class="plans">
    <div class="plan">
      <h3>Free</h3>
      <p class="price">$0</p>
      <p class="plan-tag">The full journal</p>
      <ul>
        <li>Unlimited tastings, notes &amp; photos</li>
        <li>Winery visits, map &amp; wishlist</li>
        <li>Cellar up to 25 bottles</li>
        <li>3 label scans a month</li>
        <li>5 sommelier messages a month</li>
      </ul>
    </div>
    <div class="plan pro">
      <h3>Pro</h3>
      <p class="price">$9.99<span>/mo</span></p>
      <p class="plan-tag">or $59.99/yr — six months’ price, with a 7-day free trial</p>
      <ul>
        <li>Everything in Free</li>
        <li>Unlimited sommelier chat &amp; Tonight’s Pick</li>
        <li>Unlimited label &amp; tasting-card scans</li>
        <li>Unlimited cellar, with insights &amp; drink windows</li>
        <li>Export your journal to CSV</li>
      </ul>
    </div>
  </div>
  <p class="fineprint">Pro arrives with the App Store launch. Prices in USD.</p>
</section>

<section class="faq">
  <div class="wrap">
    <h2 class="centered">Questions, answered</h2>
    ${FAQ.map(
      ([q, a]) =>
        `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`
    ).join('\n    ')}
  </div>
</section>

<section class="cta-band">
  <div class="wrap">
    <h2>Your next tasting deserves to be remembered.</h2>
    <p class="badge gold">Coming soon to the App&nbsp;Store</p>
  </div>
</section>`,
});

const support = page({
  title: 'Support · Cork & Note',
  description: 'Get help with Cork & Note.',
  active: '/support',
  main: `<div class="wrap"><article class="prose">
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
</article></div>`,
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const css = `:root{
  --burgundy:#722F37; --wine:#8B1A1A; --merlot:#5C1A1A;
  --gold:#C9A962; --gold-muted:#D4C4A8; --gold-light:#E8DCC8; --gold-text:#7E6430;
  --cream:#FAF8F5; --parchment:#F5F2ED; --linen:#EDE8E0; --stone:#D8D2C8;
  --charcoal:#2C2C2C; --graphite:#4A4A4A; --pewter:#6E6E6E;
  --sage:#5B7B5B; --slate:#6B7B8B; --error:#9B3B3B;
  --serif:Georgia,'Times New Roman',serif;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--cream);color:var(--charcoal);font-family:var(--sans);
  font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--burgundy)}
a:hover{color:var(--wine)}
h1,h2,h3{font-family:var(--serif);color:var(--charcoal);margin:0}
section{scroll-margin-top:24px}
.wrap{max-width:760px;margin:0 auto;padding:0 24px}
.wide{max-width:1060px;margin:0 auto;padding:0 24px}
.centered{text-align:center}
.eyebrow{font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold-text);margin:0 0 12px}

.bar{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;
  max-width:1060px;margin:0 auto;padding:20px 24px}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.mark{border-radius:8px;display:block}
.wordmark{font-family:var(--serif);font-size:22px;font-weight:600;letter-spacing:.5px;color:var(--burgundy)}
.bar nav{display:flex;gap:20px}
.bar nav a{font-size:15px;color:var(--graphite);text-decoration:none}
.bar nav a:hover,.bar nav a[aria-current]{color:var(--burgundy)}

.rule{height:1px;background:linear-gradient(to right,transparent,var(--gold-muted),transparent);margin:40px 0}
.double-rule{height:7px;border-top:1px solid var(--gold-muted);border-bottom:1px solid var(--gold-muted);
  width:120px;margin:0 auto}

.badge{display:inline-block;background:var(--burgundy);color:var(--cream);
  padding:12px 22px;border-radius:999px;font-size:15px;font-weight:600;margin:0}
.badge.gold{background:var(--gold);color:var(--merlot)}
.subnote{font-size:14px;color:var(--pewter);margin:10px 0 0}

.phone{width:min(300px,78vw);border-radius:44px;border:10px solid var(--charcoal);
  overflow:hidden;background:var(--charcoal);box-shadow:0 24px 48px rgba(44,44,44,.16)}
.phone img{display:block;width:100%;height:auto}

.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center;padding:40px 24px 64px}
.hero h1{font-size:52px;line-height:1.12;font-weight:400;margin:0 0 18px}
.lede{font-size:20px;color:var(--graphite);margin:0 0 28px;max-width:56ch}
.hero-media{display:flex;justify-content:center}

.pain{padding:8px 0 8px}
.pain .wrap{text-align:center;padding-top:24px;padding-bottom:24px}
.pain-line{font-family:var(--serif);font-size:27px;line-height:1.4;color:var(--charcoal);
  max-width:34ch;margin:32px auto 12px}
.pain-fix{font-family:var(--serif);font-size:20px;color:var(--burgundy);margin:0 0 32px}

.features{padding-top:16px}
.featrow{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;padding:56px 0}
.featrow.flip .feat-media{order:-1}
.feat-media{display:flex;justify-content:center}
.feat-media .phone{width:min(270px,78vw)}
.feat-text h3{font-size:30px;font-weight:400;margin:0 0 14px}
.feat-text p{color:var(--graphite);margin:0 0 14px;max-width:52ch}
.feat-text ul{margin:0;padding:0;list-style:none}
.feat-text li{position:relative;padding-left:22px;margin:0 0 10px;color:var(--graphite);font-size:15px}
.feat-text li::before{content:'';position:absolute;left:2px;top:9px;width:7px;height:7px;
  border-radius:999px;background:var(--gold)}

.cellar-band{background:var(--parchment);border-top:1px solid var(--stone);border-bottom:1px solid var(--stone);
  margin-top:32px;padding:56px 0;text-align:center}
.cellar-band h2{font-size:32px;font-weight:400;margin:0 0 14px}
.band-lede{font-size:17px;color:var(--graphite);max-width:58ch;margin:0 auto 8px}
.windows{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:26px}
.chip{display:inline-block;padding:8px 16px;border-radius:999px;font-size:14px;font-weight:600;
  background:var(--cream);border:1px solid var(--stone)}
.chip.ready{color:var(--sage);border-color:var(--sage)}
.chip.soon{color:var(--gold-text);border-color:var(--gold)}
.chip.young{color:var(--slate);border-color:var(--slate)}
.chip.past{color:var(--error);border-color:var(--error)}

.why{padding:72px 24px 24px}
.why h2{font-size:32px;font-weight:400;margin:0 0 12px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px;margin-top:36px}
.card{background:var(--parchment);border:1px solid var(--stone);border-radius:12px;padding:24px}
.card h3{font-size:20px;margin:0 0 10px;color:var(--burgundy)}
.card p{margin:0;font-size:15px;color:var(--graphite)}

.pricing{padding:72px 24px 24px}
.pricing h2{font-size:32px;font-weight:400;margin:0 0 12px}
.plans{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;
  max-width:820px;margin:36px auto 0}
.plan{background:var(--parchment);border:1px solid var(--stone);border-radius:12px;padding:28px}
.plan.pro{border-color:var(--burgundy);border-width:2px;box-shadow:0 12px 24px rgba(44,44,44,.08)}
.plan h3{font-size:15px;letter-spacing:1.5px;text-transform:uppercase;font-family:var(--sans);
  font-weight:600;color:var(--gold-text);margin:0 0 10px}
.plan.pro h3{color:var(--burgundy)}
.price{font-family:var(--serif);font-size:40px;color:var(--charcoal);margin:0}
.price span{font-size:18px;color:var(--pewter)}
.plan-tag{font-size:14px;color:var(--graphite);margin:6px 0 18px}
.plan ul{margin:0;padding:0;list-style:none;border-top:1px solid var(--stone)}
.plan li{padding:10px 0 10px 24px;position:relative;font-size:15px;color:var(--graphite);
  border-bottom:1px solid var(--linen)}
.plan li::before{content:'';position:absolute;left:2px;top:17px;width:7px;height:7px;
  border-radius:999px;background:var(--gold)}
.fineprint{text-align:center;font-size:13px;color:var(--pewter);margin:20px 0 0}

.faq{padding:72px 0 16px}
.faq h2{font-size:32px;font-weight:400;margin:0 0 24px}
.faq details{border-bottom:1px solid var(--stone);padding:4px 0}
.faq summary{font-family:var(--serif);font-size:19px;color:var(--charcoal);cursor:pointer;
  padding:14px 0;list-style-position:outside}
.faq summary:hover{color:var(--burgundy)}
.faq details p{margin:0 0 16px;color:var(--graphite);font-size:15px;max-width:64ch}

.cta-band{background:var(--burgundy);margin-top:64px;padding:72px 0;text-align:center}
.cta-band h2{color:var(--cream);font-size:34px;font-weight:400;margin:0 0 26px}

.prose{padding:16px 0 8px}
.prose h1{font-size:36px;margin:0 0 8px}
.prose h2{font-size:22px;margin:32px 0 10px;color:var(--burgundy)}
.prose p{margin:0 0 12px;color:var(--graphite)}
.prose strong{color:var(--charcoal)}
.updated{font-size:14px;color:var(--pewter);margin-bottom:24px}

footer{max-width:760px;margin:0 auto;padding:0 24px 48px;text-align:center;
  font-size:14px;color:var(--pewter)}
footer p{margin:6px 0}
footer .rule{margin-top:0}
.responsibly{color:var(--graphite)}
footer .links a{color:var(--pewter)}
footer .links a:hover{color:var(--burgundy)}

@media (max-width:900px){
  .hero{grid-template-columns:1fr;gap:40px;padding-top:24px;text-align:center}
  .lede{margin-left:auto;margin-right:auto}
  .hero h1{font-size:38px}
  .featrow{grid-template-columns:1fr;gap:32px;padding:40px 0;text-align:center}
  .featrow.flip .feat-media{order:0}
  .feat-text p,.feat-text ul{margin-left:auto;margin-right:auto}
  .feat-text ul{max-width:44ch;text-align:left}
  .pain-line{font-size:22px}
  .why h2,.pricing h2,.faq h2,.cellar-band h2{font-size:26px}
  .cta-band h2{font-size:27px}
  .prose h1{font-size:28px}
}
`;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, 'site', 'assets'), join(OUT, 'assets'), { recursive: true });

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
console.log(`Built ${Object.keys(files).length} files + assets into site/dist`);
