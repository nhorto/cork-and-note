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

export const PRIVACY_POLICY = {
  title: 'Privacy policy',
  updated: 'September 10, 2026',
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
        'Location: only if you grant location permission, and only while you are using the app — to show your position on the map, find nearby wineries, and attach a location to visits you log. The app never collects location in the background. You can revoke this at any time in iOS Settings.',
        'Camera and photo library: only if you grant permission, and only to take or choose the photos you attach to wines, visits, and scans.',
        'AI sharing: before the app sends your messages, scanned or attached photos, or journal context to Anthropic, it asks for your permission. Your choice is saved for your account on that device. You can decline and continue ordinary journaling, or turn off new AI requests in Profile → Account settings → AI sharing. Turning it off does not recall information already sent; contact us for data requests.',
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
      heading: 'Services we share data with',
      paragraphs: [
        'Supabase hosts our database, authentication, and photo storage. Your journal content, account details, and photos are stored there, scoped to your account.',
        'RevenueCat validates subscriptions and helps us enable Pro. It receives your app account identifier and store purchase/subscription history, including product, transaction, renewal and expiration information. We use this for access control, purchase restoration and subscription analytics. Apple handles payment details; Cork & Note does not receive your payment-card information.',
        'Anthropic provides the AI sommelier. When you chat with the sommelier or scan a label or tasting card, the text of your conversation, relevant context from your journal — wines you have rated and your notes on them, the bottles in your cellar, and the wineries you have visited — and any photos you scan are sent to Anthropic’s API to generate the response. Under Anthropic’s commercial terms, this data is not used to train their models.',
        'Web search (Pro only). When you ask the Pro sommelier about a specific wine, producer, or winery it may search the web to answer accurately. Anthropic runs that search on our behalf: a short search query derived from your question is sent to its search provider, and public web pages are read to build the answer. Your journal, your photos, and your account details are not part of the search query, and the search provider does not receive your identity. Replies that used a search show the pages they relied on, so you can check them.',
        'Map services (Apple Maps on iOS) display the map. Your map interactions are subject to the platform’s own privacy terms.',
        'Google Places provides live winery details and nearby search results through our server. Requests can include a winery name or place identifier, search text, and coordinates used to find nearby places. These are sent to Google to return ratings, hours and other place information; your private journal and photos are not included in Places requests.',
        'Cellar reminders are scheduled on your device; they do not send your data anywhere.',
      ],
    },
    {
      heading: 'Retention and deletion',
      paragraphs: [
        'We keep your data for as long as your account exists.',
        'You can delete your app account, photos, journal entries, cellar and chat history in Profile → Account settings → Delete account. The app removes these from its active storage during the deletion process. Information already processed by service providers, backup copies, and transaction records may be retained according to their retention policies or legal obligations. Contact us about deletion of information held by our processors.',
        'Deleting an app account does not cancel a store subscription. Manage or cancel it separately in your Apple Account subscription settings.',
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
        'If this policy changes materially, we will update the date above and note the change in the app. Continued use of the app after a change means you accept the updated policy.',
      ],
    },
  ],
};

export const TERMS_OF_USE = {
  title: 'Terms of use',
  updated: 'September 10, 2026',
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
        'Some features may require a paid subscription, billed through your Apple ID. Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period; manage or cancel them in your App Store account settings. Prices are shown before you purchase, and refunds are handled by Apple under their terms.',
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
        'We may update these terms; the date above reflects the latest version. Material changes will be noted in the app, and continued use after a change means you accept the updated terms.',
      ],
    },
    {
      heading: 'Governing law',
      paragraphs: [
        'These terms are governed by the laws of the State of Maryland and the applicable laws of the United States, without regard to conflict-of-law rules. Any dispute that is not resolved informally will be brought in the state or federal courts located in Maryland, and you and we each consent to their jurisdiction. Nothing here removes a consumer-protection right you have under the mandatory law of your own country or state of residence.',
      ],
    },
  ],
};
