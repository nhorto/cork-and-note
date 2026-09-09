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
//
// Colours come from styles/theme.js (the "Château Label" system the app uses).
// The app only ever shows cream as the gap between parchment cards, gold rules
// and burgundy blocks, so the page is built the same way: colour-blocked bands
// (burgundy / linen / cream / merlot / parchment) rather than one flat cream
// surface, which on a wide monitor reads as plain white.
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

function page({ title, description, main, active = '', extraHead = '', dark = false }) {
  const nav = [
    ['/#features', 'Features'],
    ['/#sommelier', 'Sommelier'],
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
<meta name="theme-color" content="#E4573D">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="stylesheet" href="/styles.css">
${extraHead}</head>
<body class="${dark ? 'dark-top' : ''}">
<header class="bar">
  <div class="bar-inner">
    <a class="brand" href="/">
      <img class="mark" src="/assets/logo.jpg" alt="" width="40" height="40">
      <span class="wordmark">Cork&nbsp;&amp;&nbsp;Note</span>
    </a>
    <nav>${nav}</nav>
  </div>
</header>
<main>
${main}
</main>
<footer>
  <div class="wide foot">
    <div class="foot-brand">
      <img class="mark" src="/assets/logo.jpg" alt="" width="44" height="44">
      <div>
        <p class="foot-word">Cork &amp; Note</p>
        <p class="foot-tag">Your tasting-room memory.</p>
      </div>
    </div>
    <p class="foot-links"><a href="/#features">Features</a><a href="/#pricing">Pricing</a><a href="/support">Support</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></p>
  </div>
  <div class="wide foot-legal">
    <p>Cork &amp; Note is for people of legal drinking age. Please drink responsibly.</p>
    <p>&copy; ${YEAR} Cork &amp; Note. All rights reserved.</p>
  </div>
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

// A phone frame. `stage` variants crop the bottom of the phone against the
// section edge, so a screenshot with an empty lower half still sells the screen.
const phone = (src, alt, { eager = false } = {}) =>
  `<div class="phone"><img src="/assets/${src}" alt="${esc(alt)}" width="720" height="1564"${
    eager ? ' fetchpriority="high"' : ' loading="lazy"'
  }></div>`;

const CHAPTERS = [
  {
    numeral: 'I',
    shot: 'shot-2-log-a-tasting.png',
    alt: 'Cork & Note screen for logging a wine, with a label-scan button and a rating form.',
    eyebrow: 'The journal',
    heading: 'Capture it while you’re still at the counter.',
    body: 'Log each wine as you taste it — a rating, flavour notes, a photo, and how it made you feel. Tag the winery, the restaurant, or nowhere at all. A Tuesday-night bottle with no place attached still counts.',
    points: [
      'Scan the label or the tasting card and the producer, vintage and grapes fill themselves in.',
      'Built for real tasting rooms: it tells you when you’re offline instead of pretending to save.',
    ],
  },
  {
    numeral: 'II',
    shot: 'shot-3-winery-visits.png',
    alt: 'A winery page in Cork & Note showing past visits and the wines tasted on each one.',
    eyebrow: 'The places',
    heading: 'Every winery keeps its own page.',
    body: 'Each place you’ve logged remembers the visits you’ve made, the wines you poured on each one, and the notes you left behind. Walk back in two years later knowing exactly what you loved.',
    points: [
      'Your most-visited places and latest trips, right on Home.',
      'Restaurants and tasting bars count too — anywhere you drink wine.',
    ],
  },
  {
    numeral: 'III',
    shot: 'shot-4-explore-map.jpg',
    alt: 'The Explore map in Cork & Note with pins on the wineries you have visited.',
    eyebrow: 'The map',
    heading: 'Your wine country, pinned.',
    body: 'The map fills in as you taste: every winery you’ve visited, every region you’ve worked through, and your next stop while you’re out there.',
    points: [
      'A living record of your own travels, not a directory of everyone else’s.',
      'Long-press to drop a pin on a place that isn’t listed yet.',
    ],
  },
];

const chapters = CHAPTERS.map(
  (c, i) => `<div class="chapter${i % 2 ? ' flip' : ''}">
  <div class="chapter-text">
    <p class="eyebrow"><span class="numeral">${c.numeral}</span>${esc(c.eyebrow)}</p>
    <h3>${esc(c.heading)}</h3>
    <p>${esc(c.body)}</p>
    <ul class="points">${c.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  </div>
  <div class="stage">${phone(c.shot, c.alt)}</div>
</div>`
).join('\n');

const ASKS = [
  'What should I open with the lamb tonight?',
  'I’m at the counter — the Grenache or the Syrah, given what I liked last spring?',
  'What is Trousseau, actually?',
];

const WINDOWS = [
  ['ready', 'Ready', 'Open it any night.'],
  ['soon', 'Drink soon', 'At its peak right now.'],
  ['young', 'Too young', 'Give it a few more years.'],
  ['past', 'Past peak', 'Tonight, or never.'],
];

const WHY = [
  [
    'The bottle and the place',
    'Rating apps know the wine but not the trip. Passport apps stamp the visit but forget the wine. Cork & Note keeps what you drank together with where you were.',
  ],
  [
    'A sommelier with your palate',
    'Other apps recommend from crowd scores. Cork & Note’s sommelier reasons from your own ratings, visits and cellar — advice from a friend who was there with you.',
  ],
  [
    'A journal, not a feed',
    'No followers, no public ratings, no performing. Your notes are private to you: a place to actually remember, and to learn what you like along the way.',
  ],
];

// Free/Pro split from docs/business/launch-plan-2026-09.md §4.2.
const YES = '<span class="yes" role="img" aria-label="Included">✓</span>';
const NO = '<span class="no" role="img" aria-label="Not included">—</span>';
const COMPARE = [
  ['Journal', [
    ['Tastings, ratings, flavour notes & photos', 'Unlimited', 'Unlimited'],
    ['Winery visits, map & wishlist', 'Unlimited', 'Unlimited'],
  ]],
  ['Cellar', [
    ['Bottles tracked', 'Up to 25', 'Unlimited'],
    ['Drink windows & cellar insights', NO, YES],
    ['Tonight’s Pick', NO, YES],
  ]],
  ['Sommelier & scanning', [
    ['Label & tasting-card scans', '3 a month', 'Unlimited'],
    ['Sommelier messages', '5 a month', 'Unlimited'],
  ]],
  ['Your data', [
    ['Export your journal to CSV', NO, YES],
    ['Delete everything, any time', YES, YES],
  ]],
];

const compareRows = COMPARE.map(
  ([group, rows]) =>
    `<tr class="group"><th colspan="3" scope="colgroup">${esc(group)}</th></tr>` +
    rows
      .map(
        ([label, free, pro]) =>
          `<tr><th scope="row">${esc(label)}</th><td>${free}</td><td class="pro">${pro}</td></tr>`
      )
      .join('')
).join('\n');

const PRO_WINS = [
  [
    'Scans that fill the form',
    'Point at the bottle or the tasting card and the producer, vintage and grapes fill themselves in — as many times a day as the tasting room pours.',
  ],
  [
    'A sommelier on call',
    'Ask what to open, what to try next, or what that grape on the menu is. Every answer starts from your own ratings, not a crowd score.',
  ],
  [
    'A cellar that watches itself',
    'Every bottle you own, with drink windows, insights and Tonight’s Pick from whatever is ready — no 25-bottle ceiling.',
  ],
];

const FAQ = [
  [
    'When can I get it?',
    'Cork & Note is in the final stretch of App Store preparation and launches on iPhone soon. This page will link straight to the App Store the day it’s live.',
  ],
  [
    'Will my journal get locked behind Pro?',
    'No. Everything you log — tastings, places, photos, notes, and up to 25 cellar bottles — is free for as long as you use the app. Pro only adds unlimited label scans and sommelier messages, the unlimited cellar with drink windows, and export.',
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
  title: 'Cork & Note — the wine journal for people who actually go to wineries',
  description:
    'Your tasting-room memory. Log every wine, remember where you had it, and ask a sommelier who has actually read your notes. Coming soon to the App Store.',
  active: '/',
  dark: true,
  extraHead: `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Cork & Note: Wine Journal',
    operatingSystem: 'iOS',
    applicationCategory: 'LifestyleApplication',
    description:
      'Your tasting-room memory. Log every wine, remember where you had it, and ask a sommelier who has actually read your notes.',
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Pro (monthly)', price: '9.99', priceCurrency: 'USD' },
      { '@type': 'Offer', name: 'Pro (annual)', price: '59.99', priceCurrency: 'USD' },
    ],
  })}</script>
`,
  main: `<section class="hero">
  <div class="wide hero-grid">
    <div class="hero-text">
      <p class="eyebrow">A wine journal for iPhone</p>
      <h1>The wine journal for people who <em>actually</em> go to wineries.</h1>
      <p class="lede"><strong>Your tasting-room memory.</strong> Log every wine while you’re still at the counter, keep every winery you’ve visited on a map, and ask a sommelier who has read your notes — not the internet’s.</p>
      <div class="hero-actions">
        <span class="badge">Coming soon to the App&nbsp;Store</span>
        <a class="textlink" href="#features">See how it works <span aria-hidden="true">↓</span></a>
      </div>
      <p class="subnote">Free to download on iPhone · Pro is optional</p>
    </div>
    <div class="hero-stage">${phone('shot-1-home.png', 'The Cork & Note home screen: wines tasted, places visited, Tonight’s Pick and bottles ready to drink.', { eager: true })}</div>
  </div>
</section>

<section class="pain">
  <div class="wrap">
    <div class="double-rule" role="presentation"></div>
    <p class="pain-line">You taste six wines in an afternoon, love the third one, and by the next weekend you can’t remember its name.</p>
    <p class="pain-fix">Cork &amp; Note fixes that.</p>
    <div class="double-rule" role="presentation"></div>
  </div>
</section>

<section id="features" class="features">
  <div class="wide">
    <div class="section-head">
      <p class="eyebrow">What it does</p>
      <h2>Log the wine. Keep the place. Ask the sommelier.</h2>
    </div>
    ${chapters}
  </div>
</section>

<section id="sommelier" class="somm">
  <div class="wide somm-grid">
    <div class="somm-text">
      <p class="eyebrow"><span class="numeral">IV</span>The sommelier</p>
      <h2>Ask a sommelier who has read your notes.</h2>
      <p class="lede">An AI wine companion grounded in your own ratings, visits and cellar — not a crowd score. It knows what you actually liked, because it has read your journal.</p>
      <p class="asks-label">Things you can ask</p>
      <ul class="asks">${ASKS.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      <p class="somm-note">Tonight’s Pick chooses from the bottles you own that are ready to drink. Five messages a month on Free, unlimited on Pro.</p>
    </div>
    <div class="somm-stage">${phone('shot-5-sommelier.png', 'The Cork & Note sommelier, asking what you should drink tonight from the bottles in your cellar.')}</div>
  </div>
</section>

<section class="cellar">
  <div class="wide">
    <div class="section-head">
      <p class="eyebrow">The cellar</p>
      <h2>A cellar that tells you when.</h2>
      <p class="section-lede">Track the bottles you own with drink windows that say what’s ready now, what needs holding, and what to open tonight before it slips past its peak.</p>
    </div>
    <ul class="windows">${WINDOWS.map(
      ([k, name, note]) =>
        `<li class="tile ${k}"><span class="dot" aria-hidden="true"></span><span class="tile-name">${esc(name)}</span><span class="tile-note">${esc(note)}</span></li>`
    ).join('')}</ul>
  </div>
</section>

<section class="why">
  <div class="wide">
    <div class="section-head">
      <p class="eyebrow">Why Cork &amp; Note</p>
      <h2>Wine apps make you choose: rate bottles, or track trips.</h2>
      <p class="section-lede">Cork &amp; Note keeps the whole story together — and hands it to a sommelier.</p>
    </div>
    <div class="cards">
      ${WHY.map(([h, p]) => `<div class="card"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('\n      ')}
    </div>
  </div>
</section>

<section id="pricing" class="pricing">
  <div class="wide">
    <div class="section-head">
      <p class="eyebrow">Pricing at launch</p>
      <h2>The journal is free. The sommelier is Pro.</h2>
      <p class="section-lede">Logging is never gated: every tasting, place, photo and note is free for as long as you use the app. Pro pays for the two things that cost us real money and feel like magic — the label scanner and the sommelier — plus an unlimited cellar.</p>
    </div>
    <div class="compare-wrap">
    <table class="compare">
      <thead>
        <tr>
          <th scope="col" class="feat-col">
            <span class="plan-name">Compare</span>
            <span class="feat-col-note">Everything you log is yours on either plan.</span>
          </th>
          <th scope="col" class="plan free">
            <span class="plan-name">Free</span>
            <span class="plan-price">$0</span>
            <span class="plan-tag">The full journal, forever</span>
          </th>
          <th scope="col" class="plan pro">
            <span class="plan-name">Pro</span>
            <span class="plan-price">$9.99<small>/month</small></span>
            <span class="plan-tag">or $59.99/year with a 7-day free trial</span>
          </th>
        </tr>
      </thead>
      <tbody>
        ${compareRows}
      </tbody>
    </table>
    </div>
    <div class="wins">
      ${PRO_WINS.map(([h, p]) => `<div class="win"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('\n      ')}
    </div>
    <p class="fineprint">Pro arrives with the App Store launch. Annual is six months’ price. Billed through Apple, cancel any time. Prices in USD.</p>
  </div>
</section>

<section class="faq">
  <div class="wrap">
    <div class="section-head">
      <p class="eyebrow">Questions</p>
      <h2>Answered before you ask.</h2>
    </div>
    ${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n    ')}
  </div>
</section>

<section class="cta-band">
  <div class="wrap">
    <div class="double-rule" role="presentation"></div>
    <h2>Your next tasting deserves to be remembered.</h2>
    <span class="badge">Coming soon to the App&nbsp;Store</span>
    <p class="subnote">Free to download on iPhone.</p>
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

// Faint warm paper grain, tiled. Static image: rendered once per tile, cached.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .55 0 0 0 0 .31 0 0 0 0 .14 0 0 0 .07 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";

const css = `:root{
  --burgundy:#E4573D; --wine:#B03A24; --merlot:#6B2A3A; --rose:#F0A99A;
  --gold:#F4A259; --gold-muted:#F8CBA0; --gold-light:#FDE9D2; --gold-shimmer:#C97A3D; --gold-text:#8C5A12;
  --cream:#FFF8F0; --parchment:#FFF3E6; --linen:#F2E2D2; --stone:#DCC0AC;
  --charcoal:#3D2B3D; --graphite:#5A4550; --pewter:#7A5A4E;
  --sage:#557753; --slate:#6B7B8B; --error:#C1293E;
  --serif:Georgia,'Iowan Old Style','Times New Roman',serif;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--cream) ${GRAIN};color:var(--charcoal);font-family:var(--sans);
  font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%}
a{color:var(--wine)}
a:hover{color:var(--merlot)}
h1,h2,h3{font-family:var(--serif);color:var(--charcoal);margin:0;font-weight:400}
section{scroll-margin-top:16px}
.wrap{max-width:760px;margin:0 auto;padding:0 24px}
.wide{max-width:1120px;margin:0 auto;padding:0 24px}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

.eyebrow{font-size:12px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:var(--gold-text);
  margin:0 0 14px;display:flex;align-items:center;gap:12px}
.eyebrow::before{content:'';width:28px;height:1px;background:var(--gold);flex:none}
.numeral{font-family:var(--serif);font-size:18px;letter-spacing:1px;color:var(--gold-shimmer);
  font-weight:400;margin-right:2px}
.section-head{max-width:820px;margin:0 0 48px}
.section-head h2{font-size:clamp(30px,3.3vw,42px);line-height:1.15;margin:0 0 16px}
.section-lede{font-size:18px;color:var(--graphite);margin:0;max-width:62ch}
.centered .section-head,.section-head.centered{margin-left:auto;margin-right:auto;text-align:center}
.section-head.centered .eyebrow{justify-content:center}
.section-head.centered .section-lede{margin-left:auto;margin-right:auto}

/* Rules — the app's decorative doubleLine */
.double-rule{height:7px;border-top:1px solid var(--gold);border-bottom:1px solid var(--gold);width:96px;margin:0 auto;opacity:.75}

/* Badges & links */
.badge{display:inline-block;background:var(--gold);color:var(--merlot);padding:13px 24px;border-radius:6px;
  font-size:15px;font-weight:600;letter-spacing:.2px;margin:0;white-space:nowrap}
.textlink{font-weight:600;text-decoration:none;border-bottom:1px solid currentColor;padding-bottom:1px}
.subnote{font-size:14px;color:var(--pewter);margin:16px 0 0}

/* Phone frame */
.phone{width:min(320px,80vw);border-radius:44px;border:9px solid #1F1F1F;overflow:hidden;background:#1F1F1F;
  box-shadow:0 30px 60px -10px rgba(61,43,61,.45),0 0 0 1px rgba(244,162,89,.35)}
.phone img{display:block;width:100%;height:auto}

/* ---- Header + hero: one burgundy block ---- */
.bar{background:var(--wine)}
.bar-inner{max-width:1120px;margin:0 auto;padding:22px 24px;display:flex;align-items:center;
  justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:1px solid rgba(244,162,89,.35)}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.mark{border-radius:10px;display:block;box-shadow:0 0 0 1px rgba(244,162,89,.5)}
.wordmark{font-family:var(--serif);font-size:23px;letter-spacing:.4px;color:var(--cream)}
.bar nav{display:flex;gap:26px}
.bar nav a{font-size:15px;color:var(--gold-light);text-decoration:none}
.bar nav a:hover,.bar nav a[aria-current]{color:var(--cream);border-bottom:1px solid var(--gold)}

.hero{background:
    radial-gradient(48% 55% at 78% 62%,rgba(244,162,89,.28),rgba(244,162,89,0) 70%),
    linear-gradient(180deg,var(--wine) 0%,var(--merlot) 100%);
  color:var(--cream);overflow:hidden}
.hero-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:32px;align-items:end}
.hero-text{padding:88px 0 96px}
.hero .eyebrow{color:var(--gold-light)}
.hero .eyebrow::before{background:var(--gold)}
.hero h1{font-size:clamp(40px,4.3vw,60px);line-height:1.08;letter-spacing:-.5px;color:var(--cream);margin:0 0 24px;max-width:21ch}
.hero h1 em{font-style:italic;color:var(--gold-light)}
.hero .lede{font-size:20px;line-height:1.55;color:var(--gold-light);margin:0 0 34px;max-width:54ch}
.hero .lede strong{color:var(--cream);font-weight:600}
.hero-actions{display:flex;align-items:center;gap:26px;flex-wrap:wrap}
.hero .textlink{color:var(--cream)}
.hero .textlink:hover{color:var(--gold-light)}
.hero .subnote{color:var(--gold-light)}
.hero-stage{position:relative;height:580px;align-self:end}
.hero-stage .phone{position:absolute;left:50%;top:72px;transform:translateX(-50%);width:360px}

/* ---- Pull quote band ---- */
.pain{background:var(--linen);border-top:1px solid var(--stone);border-bottom:1px solid var(--stone)}
.pain .wrap{text-align:center;padding:56px 24px}
.pain-line{font-family:var(--serif);font-style:italic;font-size:clamp(24px,2.6vw,32px);line-height:1.4;
  color:var(--charcoal);max-width:32ch;margin:28px auto 16px}
.pain-fix{font-size:13px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:var(--wine);margin:0 0 28px}

/* ---- Feature chapters ---- */
.features{padding:96px 0 40px}
.chapter{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;padding:36px 0 56px}
.chapter.flip .stage{order:-1}
.chapter-text h3{font-size:clamp(26px,2.6vw,34px);line-height:1.2;margin:0 0 16px}
.chapter-text p{color:var(--graphite);margin:0 0 18px;max-width:50ch}
.points{margin:0;padding:0;list-style:none}
.points li{position:relative;padding-left:24px;margin:0 0 10px;color:var(--graphite);font-size:15.5px}
.points li::before{content:'';position:absolute;left:2px;top:9px;width:7px;height:7px;border-radius:999px;background:var(--gold)}
.stage{position:relative;height:520px;border-radius:24px;border:1px solid var(--stone);overflow:hidden;
  background:radial-gradient(70% 60% at 50% 20%,var(--gold-light),var(--parchment) 75%)}
.stage::after{content:'';position:absolute;inset:14px;border:1px solid rgba(244,162,89,.35);border-radius:14px;pointer-events:none}
.stage .phone{position:absolute;z-index:1;left:50%;top:56px;transform:translateX(-50%);width:290px}

/* ---- Sommelier: merlot block ---- */
.somm{background:
    radial-gradient(50% 60% at 80% 50%,rgba(244,162,89,.22),rgba(244,162,89,0) 70%),
    linear-gradient(180deg,var(--merlot),var(--wine));
  color:var(--cream);overflow:hidden;margin-top:24px}
.somm-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:end}
.somm-text{padding:88px 0 88px}
.somm .eyebrow{color:var(--gold-light)}
.somm .numeral{color:var(--gold-light)}
.somm h2{font-size:clamp(32px,3.4vw,44px);line-height:1.12;color:var(--cream);margin:0 0 18px}
.somm .lede{font-size:18px;color:var(--gold-light);margin:0 0 30px;max-width:52ch}
.asks-label{font-size:12px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:var(--gold-light);margin:0 0 12px}
.asks{list-style:none;margin:0 0 24px;padding:0;display:flex;flex-direction:column;gap:10px;max-width:440px}
.asks li{font-family:var(--serif);font-size:17px;line-height:1.45;color:var(--charcoal);background:var(--parchment);
  border:1px solid var(--gold-muted);border-radius:16px 16px 16px 4px;padding:12px 18px}
.asks li::before{content:'“';color:var(--gold-shimmer)}
.asks li::after{content:'”';color:var(--gold-shimmer)}
.somm-note{font-size:14px;color:var(--gold-light);margin:0;max-width:48ch}
.somm-stage{position:relative;height:520px}
.somm-stage .phone{position:absolute;left:50%;top:150px;transform:translateX(-50%);width:320px}

/* ---- Cellar: parchment band ---- */
.cellar{background:var(--parchment);border-top:1px solid var(--stone);border-bottom:1px solid var(--stone);padding:88px 0}
.cellar .section-head{margin-bottom:36px}
.windows{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
.tile{background:var(--cream);border:1px solid var(--stone);border-radius:14px;padding:22px 20px;display:flex;flex-direction:column;gap:6px}
.dot{width:10px;height:10px;border-radius:999px;margin-bottom:8px}
.tile-name{font-family:var(--serif);font-size:22px;color:var(--charcoal)}
.tile-note{font-size:14px;color:var(--graphite)}
.tile.ready .dot{background:var(--sage)}
.tile.soon .dot{background:var(--gold)}
.tile.young .dot{background:var(--slate)}
.tile.past .dot{background:var(--error)}

/* ---- Why ---- */
.why{padding:96px 0 88px}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.card{background:var(--parchment);border:1px solid var(--stone);border-radius:14px;padding:28px 26px;position:relative}
.card::before{content:'';display:block;width:36px;height:1px;background:var(--gold);margin-bottom:18px}
.card h3{font-size:22px;margin:0 0 10px;color:var(--wine)}
.card p{margin:0;font-size:15.5px;color:var(--graphite)}

/* ---- Pricing: linen band ---- */
.pricing{background:var(--linen);border-top:1px solid var(--stone);border-bottom:1px solid var(--stone);padding:88px 0}
.compare-wrap{background:var(--cream);border:1px solid var(--stone);border-radius:18px;overflow:hidden;
  box-shadow:0 20px 40px -20px rgba(61,43,61,.25)}
.compare{width:100%;border-collapse:collapse;font-size:15.5px}
.compare th,.compare td{padding:14px 20px;text-align:left;vertical-align:middle}
.compare thead th{vertical-align:top;padding:26px 20px 22px;border-bottom:1px solid var(--stone)}
.compare .feat-col{width:44%}
.feat-col-note{display:block;font-family:var(--serif);font-size:19px;line-height:1.35;color:var(--charcoal);font-weight:400;max-width:22ch}
.compare .plan{width:28%;background:var(--parchment)}
.compare .plan.pro{background:var(--wine);color:var(--cream)}
.plan-name{display:block;font-size:12px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:var(--gold-text);margin-bottom:8px}
.plan.pro .plan-name{color:var(--gold-light)}
.plan-price{display:block;font-family:var(--serif);font-size:38px;line-height:1;color:var(--charcoal);margin-bottom:8px}
.plan.pro .plan-price{color:var(--gold-light)}
.plan-price small{font-family:var(--sans);font-size:14px;color:var(--pewter);margin-left:2px}
.plan.pro .plan-price small{color:var(--gold-light)}
.plan-tag{display:block;font-size:13px;font-weight:400;line-height:1.45;color:var(--graphite)}
.plan.pro .plan-tag{color:var(--gold-light)}
.compare tbody th{font-weight:400;color:var(--charcoal)}
.compare tbody tr{border-bottom:1px solid var(--linen)}
.compare tbody td{color:var(--graphite)}
.compare tbody td.pro{background:rgba(228,87,61,.06);color:var(--charcoal);font-weight:500}
.compare tr.group th{font-family:var(--serif);font-size:13px;letter-spacing:2px;text-transform:uppercase;
  color:var(--gold-text);padding-top:22px;padding-bottom:8px;background:var(--cream)}
.compare tr.group{border-bottom:0}
.yes{color:var(--sage);font-weight:700;font-size:17px}
.no{color:var(--stone);font-weight:700}
.wins{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:36px}
.win h3{font-size:19px;color:var(--wine);margin:0 0 8px;padding-top:16px;border-top:1px solid var(--gold-muted)}
.win p{margin:0;font-size:15px;color:var(--graphite)}
.fineprint{font-size:13px;color:var(--pewter);margin:32px 0 0}

/* ---- FAQ ---- */
.faq{padding:96px 0 80px}
.faq .section-head{margin-bottom:24px}
.faq details{border-bottom:1px solid var(--stone);padding:4px 0}
.faq details:first-of-type{border-top:1px solid var(--stone)}
.faq summary{font-family:var(--serif);font-size:20px;color:var(--charcoal);cursor:pointer;padding:16px 0;list-style:none;
  display:flex;justify-content:space-between;align-items:center;gap:16px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:'+';font-family:var(--sans);color:var(--gold-shimmer);font-size:22px;flex:none}
.faq details[open] summary::after{content:'–'}
.faq summary:hover{color:var(--wine)}
.faq details p{margin:0 0 18px;color:var(--graphite);font-size:15.5px;max-width:64ch}

/* ---- Closing band + footer ---- */
.cta-band{background:linear-gradient(180deg,var(--wine),var(--merlot));padding:88px 0 80px;text-align:center}
.cta-band h2{color:var(--cream);font-size:clamp(30px,3.4vw,44px);line-height:1.15;margin:28px auto 30px;max-width:20ch}
.cta-band .subnote{color:var(--gold-light)}
footer{background:var(--merlot);color:var(--gold-muted);font-size:14px}
.foot{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;
  padding-top:36px;padding-bottom:28px;border-top:1px solid rgba(244,162,89,.3)}
.foot-brand{display:flex;align-items:center;gap:14px}
.foot-word{font-family:var(--serif);font-size:20px;color:var(--cream);margin:0}
.foot-tag{margin:0;font-size:13px}
.foot-links{margin:0;display:flex;gap:22px;flex-wrap:wrap}
.foot-links a{color:var(--gold-light);text-decoration:none}
.foot-links a:hover{color:var(--cream)}
.foot-legal{padding-top:0;padding-bottom:40px}
.foot-legal p{margin:4px 0;font-size:13px}

/* ---- Prose pages ---- */
.prose{padding:56px 0 48px}
.prose h1{font-size:40px;margin:0 0 8px}
.prose h2{font-size:23px;margin:36px 0 10px;color:var(--wine)}
.prose p{margin:0 0 12px;color:var(--graphite)}
.prose strong{color:var(--charcoal)}
.updated{font-size:14px;color:var(--pewter);margin-bottom:24px}

@media (max-width:960px){
  .hero-grid,.somm-grid{grid-template-columns:1fr;gap:0}
  .hero-text{padding:56px 0 40px;text-align:center}
  .hero .eyebrow,.hero-actions{justify-content:center}
  .hero .lede{margin-left:auto;margin-right:auto}
  .hero-stage{height:400px}
  .hero-stage .phone{top:0;width:min(300px,78vw)}
  .section-head{margin-bottom:36px}
  .chapter{grid-template-columns:1fr;gap:28px;padding:24px 0 48px}
  .chapter.flip .stage{order:0}
  .stage{height:420px}
  .stage .phone{top:40px;width:min(270px,70vw)}
  .somm-text{padding:64px 0 40px}
  .somm-stage{height:380px}
  .somm-stage .phone{top:0;width:min(300px,78vw)}
  .windows{grid-template-columns:repeat(2,1fr)}
  .cards,.wins{grid-template-columns:1fr}
  .compare{font-size:14px}
  .compare th,.compare td{padding:12px 12px}
  .compare thead th{padding:18px 12px 16px}
  .compare .feat-col{width:36%}
  .compare .plan{width:32%}
  .feat-col-note{font-size:15px}
  .plan-price{font-size:28px}
  .plan-tag{font-size:12px}
  .somm-stage{height:340px}
  .features,.why,.faq{padding-top:72px}
  .cellar,.pricing{padding:64px 0}
  .foot{flex-direction:column;align-items:flex-start}
  .prose h1{font-size:30px}
}
@media (max-width:480px){
  .bar-inner{padding:16px 20px}
  .bar nav{gap:16px}
  .bar nav a{font-size:14px}
  .wide,.wrap{padding-left:20px;padding-right:20px}
  .hero h1{font-size:38px}
  .hero .lede{font-size:18px}
  .compare th,.compare td{padding:11px 10px}
  .compare .feat-col{width:36%}
  .compare .plan{width:32%}
  .feat-col-note{display:none}
  .plan-price{font-size:24px}
  .plan-price small{display:block;margin:4px 0 0}
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
