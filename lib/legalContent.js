// lib/legalContent.js — the privacy policy and terms of use rendered in-app
// (#162, App Store requirement). This module is the SINGLE source of truth:
// the in-app screens render it directly, and site/build.mjs generates the
// hosted /privacy and /terms pages from this same object at deploy time, so
// the two can never drift.
//
// Owner answers recorded 2026-09-08: the operator is Nicholas Horton as an
// individual (no LLC), and the governing law is Maryland, where he resides.
// Change both here and nowhere else — site/build.mjs reads this file.
//
// Confirmed by the owner on September 10, 2026: same mailbox as the Apple
// developer ID.
export const SUPPORT_EMAIL = 'cork_and_note@yahoo.com';

// ── Store wording ──────────────────────────────────────────────────────────
// Billing sentences depend on which store the reader bought through. The
// hosted pages serve both platforms, so PRIVACY_POLICY / TERMS_OF_USE (what
// site/build.mjs imports) name both stores; the in-app screens render
// legalDocsFor(Platform.OS) so a user only reads about the store they are
// actually on. This module stays dependency-free on purpose — site/build.mjs
// imports it via a data: URL in plain Node, where `react-native` does not
// resolve — which is why the platform is passed in rather than imported.
const APP_STORE = {
  paymentHandler: 'Apple',
  billedThrough: 'your Apple Account',
  subscriptionSettings: 'your Apple Account subscription settings',
  refundHandler: 'Apple',
};
const PLAY_STORE = {
  paymentHandler: 'Google',
  billedThrough: 'your Google Play account',
  subscriptionSettings: 'your Google Play subscription settings',
  refundHandler: 'Google',
};
const EITHER_STORE = {
  paymentHandler: 'Apple or Google (whichever store you purchased through)',
  billedThrough: 'your Apple Account or Google Play account',
  subscriptionSettings: 'your Apple Account or Google Play subscription settings',
  refundHandler: 'Apple or Google',
};

const buildPrivacyPolicy = (store) => ({
  title: 'Privacy policy',
  updated: 'September 11, 2026',
  sections: [
    {
      heading: 'Who we are',
      paragraphs: [
        'Cork & Note is a wine tasting journal operated by Nicholas Horton, an individual based in the State of Maryland, United States ("we", "us"). This policy explains what information the app collects, how it is used, and the choices you have.',
        `Questions or requests about your data? Email ${SUPPORT_EMAIL}. You can also use Profile → Feedback in the app.`,
      ],
    },
    {
      heading: 'Information you provide',
      paragraphs: [
        'Account: your name, email address and a password, used to create and sign in to your account.',
        'Journal content: the tastings, ratings, flavor notes, written notes, cellar bottles, wishlist entries, places, and photos you add. This content is yours; we store it so the app can show it back to you.',
        'Messages to the AI sommelier: the questions you type and any photos you scan (wine labels, tasting cards).',
        'Feedback: anything you send through the in-app contact and feedback forms.',
      ],
    },
    {
      heading: 'Information collected with your permission',
      paragraphs: [
        'Location: only if you grant location permission, and only while you are using the app — to show your position on the map, find nearby wineries, and attach a location to visits you log. The app never collects location in the background. You can revoke this at any time in your device settings.',
        'Camera and photo library: only if you grant permission, and only to take or choose the photos you attach to wines, visits, and scans.',
        'AI sharing: before the app sends your messages, scanned or attached photos, or journal context to Google Gemini or Anthropic, it asks for your permission. Your choice is saved for your account on that device. You can decline and continue ordinary journaling, or turn off new AI requests in Profile → Account settings → AI sharing. Turning it off does not recall information already sent; contact us for data requests.',
      ],
    },
    {
      heading: 'How we use your information',
      paragraphs: [
        'To provide the app: storing and syncing your journal, showing your map and stats, and generating sommelier responses.',
        'To keep the service healthy: per-account usage counters limit how often the AI features can be called (including how often the Pro sommelier searches the web), which prevents abuse.',
        'We do not sell your data, show ads, or track you across other apps or websites.',
      ],
    },
    {
      heading: 'Future optional winery insights',
      paragraphs: [
        'We do not currently provide journal data to wineries or sell winery insight reports. We may offer an optional program in the future that uses feedback from participating users to produce aggregate reports about wines and winery visits. Wineries may pay for those reports.',
        'Before using any of your content for that program, we will explain what information is included, who receives the reports, and how to withdraw, and ask you to opt in separately. Creating an account, buying Pro, or continuing to use the app does not enroll you. Existing journal entries will not be included without your explicit permission.',
        'The program would exclude names, contact details, account identifiers, photos, and individual journal text from winery reports, and suppress small groups or identifying detail that could expose an individual. You would be able to stop future participation without losing access to your journal. Any retention and withdrawal limits for reports already provided would be explained before you join.',
      ],
    },
    {
      heading: 'Services we share data with',
      paragraphs: [
        'Supabase hosts our database, authentication, and photo storage. Your journal content, account details, and photos are stored there, scoped to your account.',
        `RevenueCat validates subscriptions and helps us enable Pro. It receives your app account identifier and store purchase/subscription history, including product, transaction, renewal and expiration information. We use this for access control, purchase restoration and subscription analytics. ${store.paymentHandler} handles payment details; Cork & Note does not receive your payment-card information.`,
        'Anthropic provides the AI sommelier. When you chat with the sommelier or request recommendations, the text of your conversation, relevant context from your journal — wines you have rated and your notes on them, the bottles in your cellar, and the wineries you have visited — and any photos you attach to that conversation are sent to Anthropic’s API to generate the response. Under Anthropic’s commercial terms, this data is not used to train their models.',
        'Google Gemini reads wine-label, tasting-card, and restaurant wine-list scans. The photos you choose and the instructions needed to extract their printed wine details are sent to Google’s Gemini API. These scan requests do not include your tasting history or cellar context. Extracted entries may subsequently be sent to Anthropic when you ask for personalized wine recommendations.',
        'Web search (Pro only). When you ask the Pro sommelier about a specific wine, producer, or winery it may search the web to answer accurately. Anthropic runs that search on our behalf: a short search query derived from your question is sent to its search provider, and public web pages are read to build the answer. Your journal, your photos, and your account details are not part of the search query, and the search provider does not receive your identity. Replies that used a search show the pages they relied on, so you can check them.',
        'Map services (Apple Maps on iOS, Google Maps on Android) display the map. Your map interactions are subject to the platform’s own privacy terms.',
        'Winery discovery and directory websites are available on Free and Pro using our own directory. Pro can request additional live details from Google Places through our server. Those requests can include a winery name or place identifier and winery coordinates used to match the place, and return ratings, hours, photos and other place information. Your private journal and photos are not included in Places requests.',
        'Cellar reminders are scheduled on your device; they do not send your data anywhere.',
      ],
    },
    {
      heading: 'Retention and deletion',
      paragraphs: [
        'We keep your data for as long as your account exists.',
        'You can delete your app account, photos, journal entries, cellar and chat history in Profile → Account settings → Delete account. The app removes these from its active storage during the deletion process. Information already processed by service providers, backup copies, and transaction records may be retained according to their retention policies or legal obligations. Contact us about deletion of information held by our processors.',
        `Deleting an app account does not cancel a store subscription. Manage or cancel it separately in ${store.subscriptionSettings}.`,
      ],
    },
    {
      heading: 'Age',
      paragraphs: [
        'Cork & Note is about wine and is intended for people of legal drinking age. It is not directed at children, and we do not knowingly collect information from anyone under 18.',
      ],
    },
    {
      heading: 'Changes to this policy',
      paragraphs: [
        'If this policy changes materially, we will update the date above and notify you in the app before the change takes effect. A policy update or continued use does not grant permission to enroll you in winery insights or apply new sharing purposes to previously collected journal content; we will ask for your separate opt-in before doing so.',
      ],
    },
  ],
});

const buildTermsOfUse = (store) => ({
  title: 'Terms of use',
  updated: 'September 11, 2026',
  sections: [
    {
      heading: 'Agreement',
      paragraphs: [
        'These terms are an agreement between you and Nicholas Horton, an individual based in the State of Maryland, United States, operating Cork & Note in his personal capacity ("we", "us"). By creating an account or using the app, you accept them.',
        'You must be of legal drinking age in your country to use Cork & Note.',
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        `Keep your credentials to yourself; you are responsible for activity on your account. Provide accurate information and email ${SUPPORT_EMAIL} if you believe your account has been compromised.`,
      ],
    },
    {
      heading: 'Your content',
      paragraphs: [
        'The tastings, notes, photos, and other content you add remain yours. You grant us the limited right to store and process that content solely to operate the app for you — for example, storing your photos and sending journal context to the AI sommelier when you ask it a question.',
        'Do not upload content that is unlawful or that you do not have the right to use.',
      ],
    },
    {
      heading: 'Optional winery insights',
      paragraphs: [
        'Winery insights is a possible future, voluntary program, not a feature currently included with Free or Pro. If offered, wineries may pay for aggregate reports based on feedback from users who separately choose to participate.',
        'These terms do not grant us permission to use your journal for winery reports. Any participation would require a separate opt-in explaining the permitted data, purpose, recipients, safeguards, and withdrawal terms. Declining would not restrict ordinary journaling, and buying Pro would not enroll you.',
      ],
    },
    {
      heading: 'The AI sommelier',
      paragraphs: [
        'Sommelier responses are generated by an AI model and are suggestions, not professional advice. They can be wrong — about wine facts, pairings, drink windows, and anything else. Use your own judgment, and always drink responsibly.',
        'The Pro sommelier can search the web to answer questions about specific wines, and will show the pages it used. Those pages belong to other people: we do not control, endorse, or vouch for anything on them, and a page being cited does not make the information on it correct. Links open outside the app and are governed by those sites’ own terms.',
        'AI features have fair-use limits per account, including how often the sommelier may search the web. We may adjust these limits to keep the service reliable and affordable.',
      ],
    },
    {
      heading: 'Acceptable use',
      paragraphs: [
        'Do not misuse the app: no attempting to access other users’ data, probing or disrupting the service, reverse engineering, automated scraping, or using the AI features to generate unlawful or harmful content.',
      ],
    },
    {
      heading: 'Subscriptions',
      paragraphs: [
        `Some features may require a paid subscription, billed through ${store.billedThrough}. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period; manage or cancel them in ${store.subscriptionSettings}. Prices are shown before you purchase, and refunds are handled by ${store.refundHandler} under their terms.`,
      ],
    },
    {
      heading: 'Disclaimers',
      paragraphs: [
        'Cork & Note is provided "as is", without warranties of any kind. To the fullest extent permitted by law, we are not liable for indirect or consequential damages arising from your use of the app, and our total liability is limited to the amount you paid for the app in the twelve months before the claim.',
      ],
    },
    {
      heading: 'Termination',
      paragraphs: [
        'You can stop using Cork & Note at any time and delete your account in Profile → Account settings. We may suspend or terminate accounts that violate these terms.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'We may update these terms; the date above reflects the latest version. Material changes will be noted in the app, and continued use after a change means you accept the updated terms. This does not replace the separate opt-in required for winery insights or new sharing purposes for previously collected journal content.',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: [
        'These terms are governed by the laws of the State of Maryland and the applicable laws of the United States, without regard to conflict-of-law rules. Any dispute that is not resolved informally will be brought in the state or federal courts located in Maryland, and you and we each consent to their jurisdiction. Nothing here removes a consumer-protection right you have under the mandatory law of your own country or state of residence.',
      ],
    },
  ],
});

// The both-stores copy: what site/build.mjs publishes at /privacy and /terms.
export const PRIVACY_POLICY = buildPrivacyPolicy(EITHER_STORE);
export const TERMS_OF_USE = buildTermsOfUse(EITHER_STORE);

/**
 * The copy for one platform, for in-app rendering: an iOS user reads about
 * their Apple Account, an Android user about Google Play, and anything else
 * (web preview, tests without a platform) gets the both-stores copy.
 */
export function legalDocsFor(os) {
  const store = os === 'ios' ? APP_STORE : os === 'android' ? PLAY_STORE : EITHER_STORE;
  return {
    privacyPolicy: buildPrivacyPolicy(store),
    termsOfUse: buildTermsOfUse(store),
  };
}
