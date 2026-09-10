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
// logo from assets/images/brand-mark.png (the Royal Velvet wine-glass/pen-nib
// mark in its gold ring). Marketing copy mirrors docs/business/app-store-listing.md;
// the Free/Pro split mirrors docs/business/launch-plan-2026-09.md §4.2.
//
// Colours come from styles/theme.js (the Royal Velvet light palette the app
// uses). The app never shows one flat background — cards and bands sit on
// lavender and pale-gold surfaces between purple blocks — so the page is built
// the same way: colour-blocked bands (velvet / lavender / cream / midnight /
// parchment) rather than one flat cream surface, which on a wide monitor reads
// as plain white.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site', 'dist');
const SITE_URL = 'https://cork-and-note.vercel.app';

const legalSrc = readFileSync(join(ROOT, 'lib', 'legalContent.js'), 'utf8');
const { PRIVACY_POLICY, TERMS_OF_USE, SUPPORT_EMAIL } = await import(
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
<meta name="theme-color" content="#54258A">
<link rel="icon" type="image/png" href="/assets/favicon.png">
<link rel="stylesheet" href="/styles.css">
${extraHead}</head>
<body class="${dark ? 'dark-top' : ''}">
<header class="bar">
  <div class="bar-inner">
    <a class="brand" href="/">
      <img class="mark" src="/assets/logo.jpg" alt="" width="54" height="54">
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
        <p class="foot-tag">Remember what you tasted.</p>
      </div>
    </div>
    <p class="foot-links"><a href="/#features">Features</a><a href="/#pricing">Pricing</a><a href="/support">Support</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/delete-account">Delete account</a></p>
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

// `sectionExtras` maps a section heading to extra HTML appended inside that
// section — used to add site-only links (like /delete-account) to the hosted
// legal pages without touching lib/legalContent.js, which the app renders.
function legalPage(doc, active, sectionExtras = {}) {
  const body = doc.sections
    .map(
      (s) =>
        `<section><h2>${esc(s.heading)}</h2>${s.paragraphs
          .map((p) => `<p>${esc(p)}</p>`)
          .join('')}${sectionExtras[s.heading] || ''}</section>`
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

// Chapter order tells the positioning story (marketing plan 2026-09-09):
// memory first (broad, welcoming), the sommelier second (the help), the
// places-passport third (the proof no other wine app keeps), cellar last.
// The sommelier and places sections have their own richer layouts, so the
// chapters render individually rather than from one loop.
const chapterBlock = (c, flip = false) => `<div class="chapter${flip ? ' flip' : ''}">
  <div class="chapter-text">
    <p class="eyebrow"><span class="numeral">${c.numeral}</span>${esc(c.eyebrow)}</p>
    <h3>${esc(c.heading)}</h3>
    <p>${esc(c.body)}</p>
    <ul class="points">${c.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  </div>
  <div class="stage">${phone(c.shot, c.alt)}</div>
</div>`;

// Chapter headings are the questions a wine drinker actually asks (carried
// over from the 2026-09-08 question-led draft, owner-preferred): each chapter
// answers one of them.
const JOURNAL_CHAPTER = {
  numeral: 'I',
  shot: 'shot-2-log-a-tasting.png',
  alt: 'Cork & Note screen for logging a wine, with a label-scan button and a rating form.',
  eyebrow: 'The journal',
  heading: 'Would you have it again?',
  body: 'A bottle at home, dinner out, or a flight at the tasting bar — capture each wine while the glass is still in your hand: a rating, flavour notes, a photo, and how it made you feel. Tag the place, or don’t. A Tuesday-night bottle with no location still counts.',
  points: [
    'Scan the label or the tasting card and the producer, vintage and grapes fill themselves in.',
    'No wine vocabulary required — plain words like “honey, but dry?” are exactly the point.',
  ],
};

const PLACES_CHAPTER = {
  numeral: 'III',
  shot: 'shot-3-winery-visits.png',
  alt: 'A winery page in Cork & Note showing your past visits and notes alongside live Google rating, opening hours and website.',
  eyebrow: 'The places · your passport',
  heading: 'What did we try last time?',
  body: 'The wineries remember you back. Every place you’ve been keeps its own page — your visits, the wines you poured on each one, your notes and photos — so you walk back in knowing exactly what you loved. No other wine app keeps this.',
  points: [
    'Pro adds live winery intel from Google, right on the page: rating, opening hours, website and phone.',
    'Restaurants and tasting bars keep pages too — anywhere you drink wine counts.',
  ],
};

const MAP_CHAPTER = {
  numeral: 'IV',
  shot: 'shot-4-explore-map.png',
  alt: 'The Cork & Note map with your visited wineries, wishlist and nearby wineries in different colors.',
  eyebrow: 'The map',
  heading: 'Where should we go next?',
  body: 'Your map fills in as you travel — visited wineries in green, your wishlist in blue. With Pro, wineries near you appear around them, and you can search a directory of 14,000+ US wineries by name — so the record of your last trip plans the next one.',
  points: [
    'Long-press to pin anywhere on any plan — your places are never gated.',
    'Tap a nearby winery and its page opens with live hours and ratings, ready to visit.',
  ],
};

const ASKS = [
  'I like this wine — how would I describe it?',
  'What does “dry” actually mean?',
  'What should I open with the lamb tonight?',
  'What do the wines I’ve liked have in common?',
];

const WINDOWS = [
  ['ready', 'Ready', 'Open it any night.'],
  ['soon', 'Drink soon', 'At its peak right now.'],
  ['young', 'Too young', 'Give it a few more years.'],
  ['past', 'Past peak', 'Tonight, or never.'],
];

// Why cards: the 2026-09-08 draft's editorial-row format (numbered, headline,
// body, detail line), owner-preferred, with copy updated to the current app.
const WHY = [
  [
    'Find the wine you meant to buy again.',
    'Keep the label, vintage and your own verdict together. When you’re looking for that bottle weeks later, you have more to go on than a camera roll.',
    'Your rating answers the useful question: did you like it?',
  ],
  [
    'Learn the words as you taste.',
    'Ask the sommelier about the dry feeling after a sip or the flavour you can’t quite name. It has read your journal — because you wrote it — so its advice starts from what you actually liked.',
    'Keep the suggestions that fit. Your rating is still yours.',
  ],
  [
    'Remember why you brought it home.',
    'Link a bottle in your cellar to the tasting that sold you on it. Open your original notes when you open the bottle, then record what you think this time.',
    'The wine, the visit and the bottle stay connected — privately, and never deleted, on any plan.',
  ],
];

// Free/Pro split from docs/business/launch-plan-2026-09.md §4.2.
const YES = '<span class="yes" role="img" aria-label="Included">✓</span>';
const NO = '<span class="no" role="img" aria-label="Not included">—</span>';
const COMPARE = [
  ['Journal', [
    ['Tastings, ratings, flavour notes & photos', 'Unlimited', 'Unlimited'],
  ]],
  ['Wineries', [
    ['Your map, pins, visits & wishlist', 'Unlimited', 'Unlimited'],
    ['Live rating, hours & website on winery pages', NO, YES],
  ]],
  ['Cellar', [
    ['Bottles tracked', 'Up to 25', 'Unlimited'],
    ['Drink windows & cellar insights', NO, YES],
    ['Tonight’s Pick', NO, YES],
  ]],
  ['Sommelier & scanning', [
    ['Label & tasting-card scans', '3 to try', 'Unlimited'],
    ['Sommelier messages', '5 a month, text only', 'Unlimited, photos included'],
    ['Looks up specific wines on the web', NO, YES],
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
    'A sommelier on call',
    'Ask what to open, what to try next, or what that grape on the menu is. Every answer starts from your own ratings, not a crowd score — and when you ask about one specific bottle, it looks the wine up rather than guessing, and shows you where it read.',
  ],
  [
    'The winery, live',
    'Every winery page adds its Google rating, opening hours, website and phone next to your own history there — the record of your last visit, and everything you need to plan the next one.',
  ],
  [
    'Scans that fill the form',
    'Point at the bottle or the tasting card and the producer, vintage and grapes fill themselves in — as many times a day as the tasting room pours.',
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
    'No. Everything you log — tastings, places, photos, notes, your map, and up to 25 cellar bottles — is free for as long as you use the app, and we never delete your entries on any plan. Pro adds the unlimited sommelier (which can look specific wines up on the web), unlimited scans, live winery details, the unlimited cellar with drink windows and Tonight’s Pick, and export.',
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
    'Wine country and cell coverage are old enemies. Cork & Note tells you when you’re offline instead of pretending to save, so you always know whether a note has landed.',
  ],
  [
    'What about Android?',
    'Cork & Note launches on iPhone first. Android will follow if enough people ask for it — tell us on the support page.',
  ],
];

const home = page({
  title: 'Cork & Note — remember what you tasted, discover what you like',
  description:
    'A wine journal with a personal AI sommelier and a map of every winery you’ve visited. Log any wine, anywhere — no expertise needed. Coming soon to the App Store.',
  active: '/',
  dark: true,
  extraHead: `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Cork & Note: Wine Journal',
    operatingSystem: 'iOS',
    applicationCategory: 'LifestyleApplication',
    description:
      'A wine journal with a personal AI sommelier and a map of every winery you’ve visited. Log any wine, anywhere — no expertise needed.',
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
      <p class="eyebrow">Your wine journal &amp; personal AI sommelier</p>
      <h1>Remember what you tasted. Discover what you like.</h1>
      <p class="lede">Log any wine in plain words, ask a sommelier who has read your notes, and watch a map of your wine life fill in — every winery remembered, visit by visit. For a bottle at home, dinner out, or a day in wine country. <strong>No wine expertise needed.</strong></p>
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
    <p class="pain-line">You remember <em>liking</em> it — the label, the porch, the second pour. A week later, the name is gone.</p>
    <p class="pain-fix">Cork &amp; Note fixes that.</p>
    <div class="double-rule" role="presentation"></div>
  </div>
</section>

<section id="features" class="features">
  <div class="wide">
    <div class="section-head">
      <p class="eyebrow">What it does</p>
      <h2>Log the wine. Ask the sommelier. Keep the places.</h2>
    </div>
    ${chapterBlock(JOURNAL_CHAPTER)}
  </div>
</section>

<section id="sommelier" class="somm">
  <div class="wide somm-grid">
    <div class="somm-text">
      <p class="eyebrow"><span class="numeral">II</span>The sommelier</p>
      <h2>Ask a sommelier who has read your notes.</h2>
      <p class="lede">An AI wine companion grounded in your own ratings, visits and cellar — not a crowd score. It knows what you actually liked, because it has read your journal. Beginner questions are its favourite kind.</p>
      <p class="asks-label">Things you can ask</p>
      <ul class="asks">${ASKS.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
      <p class="somm-note">Five messages a month on Free, unlimited on Pro. Tonight’s Pick — the sommelier choosing from your own ready-to-drink bottles — is part of Pro.</p>
    </div>
    <div class="somm-stage">${phone('shot-5-sommelier.png', 'The Cork & Note sommelier answering a plain-words question about the wines you have rated.')}</div>
  </div>
</section>

<section class="features">
  <div class="wide">
    ${chapterBlock(PLACES_CHAPTER, true)}
    ${chapterBlock(MAP_CHAPTER)}
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
      <h2>More useful every time you come back to it.</h2>
      <p class="section-lede">Rating apps know the wine but not the trip. Passport apps stamp the visit but forget the wine. Cork &amp; Note keeps the whole story together — and hands it to a sommelier.</p>
    </div>
    <div class="cards">
      ${WHY.map(([h, p, detail], i) => `<article class="card"><span class="why-number" aria-hidden="true">0${i + 1}</span><h3>${esc(h)}</h3><div><p>${esc(p)}</p><p class="why-detail">${esc(detail)}</p></div></article>`).join('\n      ')}
    </div>
  </div>
</section>

<section id="pricing" class="pricing">
  <div class="wide">
    <div class="section-head">
      <p class="eyebrow">Pricing at launch</p>
      <h2>Start with a free journal. Get more help with Pro.</h2>
      <p class="section-lede">Logging is never gated: every tasting, place, photo and note is free for as long as you use the app — and never deleted. Pro adds the parts that help: an unlimited sommelier and scanner, live winery details, and the full cellar.</p>
    </div>
    <div class="plan-cards">
      <article class="plan-card">
        <p class="eyebrow">Free</p><h3>Your everyday wine journal.</h3><p class="card-price">$0</p><p class="plan-description">For keeping track of what you taste, and trying everything once.</p>
        <ul class="plan-features"><li>Unlimited tastings, notes and photos</li><li>Winery visits, your map and wishlist</li><li>Up to 25 bottles in your cellar</li><li>3 label or tasting-card scans to try</li><li>5 sommelier messages a month</li></ul>
        <div class="plan-action"><p>Coming soon for iPhone</p><a class="plan-button" href="#plan-comparison">Compare all features <span aria-hidden="true">↓</span></a></div>
      </article>
      <article class="plan-card pro-card">
        <p class="eyebrow">Pro</p><h3>More guidance with every tasting.</h3><p class="card-price">$9.99<span>/ month</span></p><p class="annual-price">or $59.99 / year with 3 days free</p><p class="plan-description">Everything in Free, with more room to ask, scan and explore.</p>
        <ul class="plan-features"><li>Unlimited sommelier conversations — photos and web lookups included</li><li>Live winery ratings, hours &amp; websites, plus nearby-winery discovery</li><li>Unlimited label and tasting-card scans</li><li>Unlimited cellar with drink windows and Tonight’s Pick</li><li>Export your journal to CSV</li></ul>
        <div class="plan-action"><p>Coming soon for iPhone</p><a class="plan-button" href="#plan-comparison">Compare all features <span aria-hidden="true">↓</span></a></div>
      </article>
    </div>
    <div id="plan-comparison" class="comparison-section">
    <h3>Compare all features</h3>
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
            <span class="plan-tag">or $59.99/year with a 3-day free trial</span>
          </th>
        </tr>
      </thead>
      <tbody>
        ${compareRows}
      </tbody>
    </table>
    </div>
    </div>
    <div class="wins">
      ${PRO_WINS.map(([h, p]) => `<div class="win"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('\n      ')}
    </div>
    <p class="fineprint">Pro arrives with the App Store launch. Annual is six months’ price. Billed through Apple, cancel any time. Prices in USD. Unlimited features are subject to fair-use limits no wine journaler will ever meet.</p>
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
    <p>Email <a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a> for help, account access or privacy requests. You do not need to sign in to contact us.</p>
    <p>The fastest way to reach us is from inside the app: open <strong>Profile → Feedback</strong>. That form sends us your message along with your app version, which usually saves a round trip.</p>
    <p>You can also report a bug the same way — choose the bug option and describe what you were doing when it happened.</p>
  </section>

  <section>
    <h2>Common questions</h2>
    <p><strong>How do I find the wines I have logged?</strong> Open the <strong>Journal</strong> tab. Open the <strong>Map</strong> to browse places.</p>
    <p><strong>How do I delete my account?</strong> Open <strong>Profile → Account settings → Delete account</strong> to remove your account and its app data. Deleting your account does not cancel an Apple subscription. Cancel it separately in your Apple Account settings. For help accessing your account or a data request, email us above.</p>
    <p><strong>Is the sommelier always right?</strong> No. It is an AI assistant and it can be wrong about wine facts, pairings and drink windows. Treat it as a knowledgeable friend, not an authority — and please drink responsibly.</p>
  </section>

  <section>
    <h2>Privacy</h2>
    <p>Our <a href="/privacy">privacy policy</a> explains exactly what we collect and who we share it with, including what happens when you talk to the sommelier.</p>
    <p>You can delete your account and all of its data at any time — see <a href="/delete-account">Delete your account</a>.</p>
  </section>
</article></div>`,
});

// Account-deletion page — required by Google Play's account-deletion policy:
// a web page, reachable without the app installed, that explains both the
// in-app deletion path and an out-of-app way to request deletion. What is
// deleted and the retention statement mirror lib/legalContent.js ("Retention
// and deletion") and supabase/functions/delete-account/index.ts (photos →
// database rows → auth user, all-or-nothing). SUPPORT_EMAIL is imported from
// lib/legalContent.js above (owner-confirmed mailbox).
const deleteAccount = page({
  title: 'Delete your account · Cork & Note',
  description:
    'How to permanently delete your Cork & Note account and all of its data — in the app, or by email without the app installed.',
  active: '/delete-account',
  main: `<div class="wrap"><article class="prose">
  <h1>Delete your account</h1>
  <p>Cork &amp; Note is a wine tasting journal operated by Nicholas Horton (app: <strong>Cork &amp; Note</strong>, package <code>com.nicholashorton.corkandnote</code>). This page explains how to permanently delete your Cork &amp; Note account and everything in it — whether or not you still have the app installed.</p>

  <section>
    <h2>Delete from inside the app</h2>
    <p>Open <strong>Profile → Account settings → Delete account</strong> and confirm. Deletion is immediate and cannot be undone.</p>
  </section>

  <section>
    <h2>Request deletion without the app</h2>
    <p>If you no longer have the app installed, email <a href="mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20Cork%20%26%20Note%20account"><strong>${SUPPORT_EMAIL}</strong></a> with the subject line <strong>“Delete my Cork &amp; Note account”</strong>.</p>
    <p>Send the request <strong>from the email address your account is registered under</strong> — that is how we verify the request is really yours. We will confirm by reply and permanently delete the account.</p>
  </section>

  <section>
    <h2>What gets deleted</h2>
    <p>Account deletion permanently removes everything associated with your account:</p>
    <p><strong>Your account itself</strong> — email address and sign-in credentials.<br>
    <strong>Your journal</strong> — tastings, ratings, flavor notes, written notes, places and visits, and wishlist entries.<br>
    <strong>Your photos</strong> — every photo you attached to wines, visits, and scans, including the stored files.<br>
    <strong>Your cellar</strong> — all tracked bottles and their history.<br>
    <strong>Your sommelier conversations</strong> — the AI chat history and the journal context it drew on.</p>
    <p>Deletion is all-or-nothing by design: if any step fails, nothing is removed and you can try again. There is no partial account deletion, but you can delete individual entries in the app at any time.</p>
  </section>

  <section>
    <h2>Retention</h2>
    <p>We keep your data only for as long as your account exists. When your account is deleted, the app removes your journal, photos, cellar and chat history from its active storage, and the deletion cannot be undone. Information already processed by service providers, backup copies, and transaction records may be retained according to their retention policies or legal obligations — email us about deletion of information held by our processors.</p>
  </section>

  <section>
    <h2>Subscriptions</h2>
    <p>Pro subscriptions are billed by Apple or Google, not by us, and <strong>deleting your account does not cancel a subscription</strong>. Cancel it separately in your App&nbsp;Store subscription settings (iPhone) or Google&nbsp;Play subscription settings (Android) — ideally before deleting the account.</p>
  </section>

  <section>
    <h2>Questions</h2>
    <p>Anything unclear, or want a hand? Email <a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a> or see our <a href="/privacy">privacy policy</a> and <a href="/support">support page</a>.</p>
  </section>
</article></div>`,
});

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

// Faint warm paper grain, tiled. Static image: rendered once per tile, cached.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 .33 0 0 0 0 .15 0 0 0 0 .54 0 0 0 .05 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";

const css = `:root{
  --velvet:#54258A; --royal:#421B70; --midnight:#32165E; --lilac:#C9AEDF;
  --gold:#D6B45D; --gold-muted:#E8D9B4; --gold-light:#F7F0DF; --gold-shimmer:#96752B; --gold-text:#806124;
  --cream:#FAF8F4; --parchment:#F7F0DF; --linen:#EEE6F7; --stone:#D9D1E0;
  --charcoal:#2E2438; --graphite:#5E506A; --pewter:#746779;
  --sage:#55745E; --slate:#596F8B; --error:#AD354F;
  --serif:Georgia,'Iowan Old Style','Times New Roman',serif;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--cream) ${GRAIN};color:var(--charcoal);font-family:var(--sans);
  font-size:17px;line-height:1.6;-webkit-font-smoothing:antialiased}
img{max-width:100%}
a{color:var(--royal)}
a:hover{color:var(--midnight)}
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
.badge{display:inline-block;background:var(--gold);color:var(--midnight);padding:13px 24px;border-radius:6px;
  font-size:15px;font-weight:600;letter-spacing:.2px;margin:0;white-space:nowrap}
.textlink{font-weight:600;text-decoration:none;border-bottom:1px solid currentColor;padding-bottom:1px}
.subnote{font-size:14px;color:var(--pewter);margin:16px 0 0}

/* Phone frame */
.phone{width:min(320px,80vw);border-radius:44px;border:9px solid #1F1F1F;overflow:hidden;background:#1F1F1F;
  box-shadow:0 30px 60px -10px rgba(33,21,46,.45),0 0 0 1px rgba(214,180,93,.35)}
.phone img{display:block;width:100%;height:auto}

/* ---- Header + hero: one royal-purple block ---- */
.bar{background:var(--royal)}
.bar-inner{max-width:1120px;margin:0 auto;padding:22px 24px;display:flex;align-items:center;
  justify-content:space-between;gap:16px;flex-wrap:wrap;border-bottom:1px solid rgba(214,180,93,.35)}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none}
.mark{border-radius:22.4%;display:block;box-shadow:0 0 0 1px rgba(214,180,93,.5)}
.wordmark{font-family:var(--serif);font-size:23px;letter-spacing:.4px;color:var(--cream)}
.bar nav{display:flex;gap:26px}
.bar nav a{font-size:15px;color:var(--gold-light);text-decoration:none}
.bar nav a:hover,.bar nav a[aria-current]{color:var(--cream);border-bottom:1px solid var(--gold)}

.hero{background:
    radial-gradient(48% 55% at 78% 62%,rgba(214,180,93,.28),rgba(214,180,93,0) 70%),
    linear-gradient(180deg,var(--royal) 0%,var(--midnight) 100%);
  color:var(--cream);overflow:hidden}
.hero-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:32px;align-items:center}
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
/* Full phone, in normal flow — never cropped, no plate behind it (owner
   feedback 2026-09-09: the cut-off phones in boxes looked terrible). */
.hero-stage{display:flex;justify-content:center;padding:24px 0}
.hero-stage .phone{width:min(340px,80vw)}

/* ---- Pull quote band ---- */
.pain{background:var(--linen);border-top:1px solid var(--stone);border-bottom:1px solid var(--stone)}
.pain .wrap{text-align:center;padding:56px 24px}
.pain-line{font-family:var(--serif);font-style:italic;font-size:clamp(24px,2.6vw,32px);line-height:1.4;
  color:var(--charcoal);max-width:32ch;margin:28px auto 16px}
.pain-fix{font-size:13px;font-weight:600;letter-spacing:2.2px;text-transform:uppercase;color:var(--royal);margin:0 0 28px}

/* ---- Feature chapters ---- */
.features{padding:96px 0 40px}
.chapter{display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;padding:36px 0 56px}
.chapter.flip .stage{order:-1}
.chapter-text h3{font-size:clamp(26px,2.6vw,34px);line-height:1.2;margin:0 0 16px}
.chapter-text p{color:var(--graphite);margin:0 0 18px;max-width:50ch}
.points{margin:0;padding:0;list-style:none}
.points li{position:relative;padding-left:24px;margin:0 0 10px;color:var(--graphite);font-size:15.5px}
.points li::before{content:'';position:absolute;left:2px;top:9px;width:7px;height:7px;border-radius:999px;background:var(--gold)}
.stage{display:flex;justify-content:center;align-items:center}
.stage .phone{width:min(300px,78vw)}

/* ---- Sommelier: midnight block ---- */
.somm{background:
    radial-gradient(50% 60% at 80% 50%,rgba(214,180,93,.22),rgba(214,180,93,0) 70%),
    linear-gradient(180deg,var(--midnight),var(--royal));
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
.somm-stage{display:flex;justify-content:center;align-items:center;padding:24px 0}
.somm-stage .phone{width:min(300px,78vw)}

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
.cards{border-top:1px solid var(--stone)}
.card{display:grid;grid-template-columns:48px .85fr 1.2fr;gap:28px;padding:32px 0;border-bottom:1px solid var(--stone);align-items:start}
.why-number{font-family:var(--serif);font-size:22px;color:var(--gold-text)}
.card h3{font-size:27px;line-height:1.25;margin:0;color:var(--royal);max-width:21ch}
.card p{margin:0;font-size:15.5px;color:var(--graphite)}
.card .why-detail{margin-top:12px;font-size:14px;color:var(--royal)}

/* ---- Pricing: linen band ---- */
.pricing{background:var(--linen);border-top:1px solid var(--stone);border-bottom:1px solid var(--stone);padding:88px 0}
.compare-wrap{background:var(--cream);border:1px solid var(--stone);border-radius:18px;overflow:hidden;
  box-shadow:0 20px 40px -20px rgba(33,21,46,.25)}
.compare{width:100%;border-collapse:collapse;font-size:15.5px}
.compare th,.compare td{padding:14px 20px;text-align:left;vertical-align:middle}
.compare thead th{vertical-align:top;padding:26px 20px 22px;border-bottom:1px solid var(--stone)}
.compare .feat-col{width:44%}
.feat-col-note{display:block;font-family:var(--serif);font-size:19px;line-height:1.35;color:var(--charcoal);font-weight:400;max-width:22ch}
.compare .plan{width:28%;background:var(--parchment)}
.compare .plan.pro{background:var(--royal);color:var(--cream)}
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
.compare tbody td.pro{background:rgba(84,37,138,.07);color:var(--charcoal);font-weight:500}
.compare tr.group th{font-family:var(--serif);font-size:13px;letter-spacing:2px;text-transform:uppercase;
  color:var(--gold-text);padding-top:22px;padding-bottom:8px;background:var(--cream)}
.compare tr.group{border-bottom:0}
.yes{color:var(--sage);font-weight:700;font-size:17px}
.no{color:var(--stone);font-weight:700}
.wins{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:36px}
.win h3{font-size:19px;color:var(--royal);margin:0 0 8px;padding-top:16px;border-top:1px solid var(--gold-muted)}
.win p{margin:0;font-size:15px;color:var(--graphite)}
/* Plan cards (ported from the 2026-09-08 question-led draft, owner-preferred) */
.plan-cards{display:grid;grid-template-columns:1fr 1fr;gap:24px;align-items:stretch;margin-bottom:12px}
.plan-card{background:var(--cream);border:1px solid var(--stone);border-radius:16px;padding:32px;display:flex;flex-direction:column}
.plan-card h3{font-size:30px;line-height:1.2;margin:6px 0 0;max-width:18ch;min-height:72px}
.card-price{font-family:var(--serif);font-size:48px;line-height:1.1;margin:24px 0 8px;color:var(--velvet)}
.card-price span{font-family:var(--sans);font-size:15px;color:var(--graphite);margin-left:6px}
.annual-price{font-size:14px;margin:0 0 10px;color:var(--velvet)}
.plan-description{font-size:16px;color:var(--graphite);max-width:36ch}
.plan-features{padding:0;list-style:none;margin:20px 0 28px;display:grid;gap:12px;font-size:15px}
.plan-features li{padding-left:24px;position:relative}
.plan-features li::before{content:'✓';position:absolute;left:0;color:var(--sage)}
.plan-action{margin-top:auto}
.plan-action p{font-size:12px;color:var(--pewter);margin:0 0 12px}
.plan-button{display:block;border:1px solid var(--velvet);color:var(--velvet);border-radius:6px;padding:13px 20px;text-align:center;font-size:15px;font-weight:600;text-decoration:none}
.plan-button:hover{background:var(--parchment)}
.pro-card{border-top:5px solid var(--velvet);padding-top:28px;background:linear-gradient(155deg,var(--gold-light),var(--cream) 55%)}
.pro-card .plan-button{background:var(--velvet);color:var(--cream)}
.pro-card .plan-button:hover{background:var(--royal)}
.comparison-section{margin-top:52px;scroll-margin-top:24px}
.comparison-section>h3{font-size:27px;margin-bottom:22px}
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
.faq summary:hover{color:var(--royal)}
.faq details p{margin:0 0 18px;color:var(--graphite);font-size:15.5px;max-width:64ch}

/* ---- Closing band + footer ---- */
.cta-band{background:linear-gradient(180deg,var(--royal),var(--midnight));padding:88px 0 80px;text-align:center}
.cta-band h2{color:var(--cream);font-size:clamp(30px,3.4vw,44px);line-height:1.15;margin:28px auto 30px;max-width:20ch}
.cta-band .subnote{color:var(--gold-light)}
footer{background:var(--midnight);color:var(--gold-muted);font-size:14px}
.foot{display:flex;justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;
  padding-top:36px;padding-bottom:28px;border-top:1px solid rgba(214,180,93,.3)}
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
.prose h2{font-size:23px;margin:36px 0 10px;color:var(--royal)}
.prose p{margin:0 0 12px;color:var(--graphite)}
.prose strong{color:var(--charcoal)}
.updated{font-size:14px;color:var(--pewter);margin-bottom:24px}

@media (max-width:960px){
  .hero-grid,.somm-grid{grid-template-columns:1fr;gap:0}
  .hero-text{padding:56px 0 40px;text-align:center}
  .hero .eyebrow,.hero-actions{justify-content:center}
  .hero .lede{margin-left:auto;margin-right:auto}
  .hero-stage .phone{width:min(280px,78vw)}
  .section-head{margin-bottom:36px}
  .chapter{grid-template-columns:1fr;gap:28px;padding:24px 0 48px}
  .chapter.flip .stage{order:0}
  .stage .phone{width:min(270px,74vw)}
  .somm-text{padding:64px 0 40px}
  .somm-stage .phone{width:min(280px,78vw)}
  .windows{grid-template-columns:repeat(2,1fr)}
  .wins{grid-template-columns:1fr}
  .card{grid-template-columns:32px .9fr 1.1fr;gap:20px}
  .plan-cards{grid-template-columns:1fr}
  .compare{font-size:14px}
  .compare th,.compare td{padding:12px 12px}
  .compare thead th{padding:18px 12px 16px}
  .compare .feat-col{width:36%}
  .compare .plan{width:32%}
  .feat-col-note{font-size:15px}
  .plan-price{font-size:28px}
  .plan-tag{font-size:12px}
  .features,.why,.faq{padding-top:72px}
  .cellar,.pricing{padding:64px 0}
  .foot{flex-direction:column;align-items:flex-start}
  .prose h1{font-size:30px}
}
@media (max-width:480px){
  .card{grid-template-columns:28px 1fr;gap:12px 18px;padding:28px 0}
  .card h3{max-width:none;font-size:25px}
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
  'privacy.html': legalPage(PRIVACY_POLICY, '/privacy', {
    'Retention and deletion':
      '<p>No longer have the app installed? You can <a href="/delete-account">request account deletion by email</a> instead.</p>',
  }),
  'terms.html': legalPage(TERMS_OF_USE, '/terms'),
  'support.html': support,
  'delete-account.html': deleteAccount,
  'styles.css': css,
};

for (const [name, contents] of Object.entries(files)) {
  writeFileSync(join(OUT, name), contents);
}
console.log(`Built ${Object.keys(files).length} files + assets into site/dist`);
