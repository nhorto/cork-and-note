# Cork & Note: positioning, website messaging, and first-user marketing

**Prepared September 9, 2026. Working report for discussion.**

The recommendation is to position Cork & Note as **a personal wine journal with a friendly AI sommelier: remember what you tried, understand what you like, and get help exploring wine.**

Lead with the benefit of remembering your wines. Introduce the sommelier in the opening description and demonstrate its usefulness early. Make casual wine drinkers feel welcome through familiar situations and simple questions. Keep winery visits as an important use case and a focused way to reach early users.

This report reviews the live homepage text, its source, app screenshots, relevant implementation, and earlier business plans. Competitor observations come from current first-party product pages. I did not run the signed-in native app or test live AI responses. Implementation findings establish what information is available to a feature; they do not establish response quality. No app or website changes were made.

**Open assumptions:** the primary audience is the curious casual wine drinker; the voice should be warm and approachable; the existing iPhone-first US launch and Virginia outreach plan remain relevant. Launch timing, founder marketing capacity, current tester feedback, and the preferred balance between tasting guidance and recommendations await the founder's answers. Proposed copy is a discussion draft, with publication dependencies identified below.

## 1. The message to build around

The main promise should be easy to repeat:

> Remember the wines you try and what you thought of them, with a personal AI sommelier to help you along the way.

The journal and sommelier belong in one story. Someone records a wine and their reaction; those notes help them remember it and give the sommelier useful context for later questions. A question during a tasting can also help someone put their own experience into words and save a more meaningful note.

The desired experience is:

**Try a wine → record your reaction → ask a question → use that understanding next time.**

This is an intended user journey, not a claim that a persistent taste model or automatic learning program already exists.

Use this priority order throughout the marketing:

| Priority | What the person gets | What demonstrates it |
| --- | --- | --- |
| 1 | Remember wines and personal favorites | Saved wine, rating, photo, and a recognizable personal note |
| 2 | Understand wine without needing the vocabulary first | A useful conversation about something the person actually notices |
| 3 | Get suggestions informed by their experience | An answer that accurately refers to available recent ratings or notes |
| 4 | Keep the rest of their wine life organized | Winery visits, places, bottles at home, and cellar tools |

“Wine journal” is a clear category. “Your wine companion” supplies warmth. “Personal AI sommelier” explains the assistance. Each phrase has a job; there is no need to make one phrase carry every feature.

## 2. Who the homepage should welcome

The strongest starting audience hypothesis is **someone who enjoys wine, is curious about their preferences, and wants to remember worthwhile bottles without making wine a serious hobby.**

That includes someone opening a grocery-store bottle at home, comparing wines at a tasting, or trying something new over dinner. These are different settings for the same need. The homepage can include all three without becoming a generic “wine app for everyone.”

“Casual” describes their relationship with wine, not their spending power, intelligence, or appetite for useful tools. Avoid making visitors identify as beginners. Let them recognize themselves through questions such as “I like this, but how would I describe it?”

Experienced drinkers can still find value in detailed notes and cellar features. The opening message should make a small starting point feel sufficient. “Keep track of the bottles you have at home” is easier to relate to than opening with collection management and peak drinking windows.

The broad audience and the launch channel are separate decisions. A Virginia tasting room can be an effective place to meet curious casual drinkers. Someone who discovers Cork & Note there should also understand why it will be useful at their next dinner at home.

## 3. What the current marketing communicates

The existing page has useful assets: a concrete forgotten-favorite problem, a personal journal, privacy from public social activity, and visible Free/Pro information. Its weakness is the weight given to winery travel and the lack of demonstrated tasting help.

| Current wording or evidence | Likely interpretation to test | Recommended direction |
| --- | --- | --- |
| “The wine journal for people who actually go to wineries.” | Visiting wineries is an entry requirement; “actually” may sound like a test of seriousness | Open with remembering wines and preferences |
| Repeated counter, winery, map, and travel references | The app is mainly useful on wine trips | Include home, dinner, and tasting-room examples early |
| The sommelier is the fourth numbered feature | Guidance is a secondary feature | Explain memory and guidance together before expanding into places and cellar tools |
| Questions about Grenache, Syrah, and Trousseau | The visitor should already know grapes and wine terminology | Start with tasting, descriptions, preferences, and simple pairing questions |
| The sommelier screenshot shows an empty chat and a cellar picker | The assistant chooses owned bottles; its teaching ability is unclear | Use a captured, successful beginner conversation as marketing evidence |
| “The journal is free. The sommelier is Pro.” | A free user cannot try the assistant | State the free allowance clearly |
| Pro is explained partly through what costs the developer money | The buyer is asked to justify infrastructure expense | Describe the additional help and convenience the subscription provides |
| “Coming soon” badges without a launch signup | Interested visitors have no direct way to request a launch notice | Recommend a launch-notification action once an actual signup flow exists |

These are messaging recommendations. They do not require a redesign to start evaluating. A document containing replacement copy and a genuine product demonstration is enough for initial comprehension interviews.

The [App Store listing draft](../business/app-store-listing.md) repeats the winery-only framing. When the positioning is settled, align the listing, homepage title and description, social biography, screenshots, partner cards, and launch announcement.

## 4. How prominently to feature AI

**Make the personal help prominent and identify it clearly as AI.** Mention “personal AI sommelier” in the first screen's description, explain it in ordinary language, and show an actual exchange early. The main headline can focus on the user's outcome.

People should immediately understand both parts: “This keeps track of my wines” and “I can ask it for help.” Repeating “AI-powered” across several sections does less to explain either part than showing one relevant conversation.

A useful opening demonstration would show a person asking what a wine term means, describing their own reaction, and receiving a clear follow-up that helps them write a note. A second demonstration can show a suggestion informed by a real saved rating.

The competitive evidence makes specificity necessary:

| Product | What its own website currently describes | Implication for Cork & Note |
| --- | --- | --- |
| Vivino | A sommelier chat combining a personal taste profile with its wine data | Personalization and AI chat are already marketed by a large incumbent. [Vivino Premium](https://www.vivino.com/en/premium) |
| InVintory | Vincent answers questions about owned bottles, food pairings, personal notes, and wine terminology | “Ask about your own wines” is an established promise. [Vincent help](https://help.invintory.com/en/articles/14304130-how-to-ask-vincent-about-your-collection) |
| Sommo | A personal journal, simple ratings, advanced tasting notes, and AI analysis of journal history; it also promotes tasting-flight scanning | The journal-plus-guidance combination has direct competition, including in tasting rooms. [Wine journal](https://sommo.app/features/wine-journal/), [tasting mode](https://sommo.app/blog/wine-tasting-mode/) |
| Hello Vino | Recommendations based on preferences, meals, and occasions, plus notes and ratings | Everyday wine assistance already has a familiar consumer framing. [Hello Vino](https://app.hellovino.com/) |

These are vendor descriptions, not independent assessments of their quality. Availability can vary by platform or market. This research does not establish which product users prefer.

The June strategy's assertions that no competitor offers the combination, and that other apps only recommend from crowd ratings, should not be carried forward. Cork & Note can earn preference through an approachable experience, useful guidance, a free journal, and relationships with early users. That is a positioning hypothesis to validate through use, rather than a claim of exclusive technology.

## 5. Promises to keep within the product's actual capabilities

Several findings affect what the marketing can honestly say:

| Finding in the current repository | Wording or validation consequence |
| --- | --- |
| General chat receives up to 20 wines selected from recent visits, including overall ratings, flavor tags, and written notes. It does not receive the entire journal or general cellar inventory. | Use “can draw on your recent ratings and notes.” Avoid promising recall of any wine from any year or complete understanding of the user's palate. [AI context](../../lib/ai.js) |
| “Tonight's Pick” has a separate prompt containing current cellar inventory and bottle information. | Describe owned-bottle selection through that named feature. Do not imply every general chat knows all owned bottles. [Cellar sommelier](../../lib/cellarSommelier.js) |
| Chat is available while a wine is being logged and receives the current form's contents. | There is a foundation for contextual tasting help. Test it with novices before promising a reliable guided tasting experience. [Wine chat](../../components/WineChatModal.js) |
| The base assistant prompt still describes a Bordeaux trip. | Confirm that everyday, non-French wine questions receive appropriate guidance before promoting a broad personal companion. [AI context](../../lib/ai.js) |
| AI suggestions may include an overall quality rating and inferred flavor descriptions; suggestions are presented for user review. | A taste-centered brand should preserve the distinction between the user's reaction and AI expectations. Validate that novices understand the difference. An AI-generated quality score should not be presented as evidence of what the person liked. [Suggestions handling](../../components/WineEntryForm.js) |
| Free limits in code are three scans and five chat uses per month. “Tonight's Pick” calls the shared chat gate, while the website marks it Pro-only. | Resolve the entitlement description before publishing a new pricing comparison. Check the release build and server configuration; repository behavior alone does not establish what is deployed. [Limits](../../lib/pro.js), [picker gate](../../components/TonightsPickCard.js), [access hook](../../hooks/usePro.js) |
| Only the producer is required by the wine-entry form; detailed ratings and tasting notes are optional. | Reassure people that they can start simply. Avoid a speed claim until someone has measured the complete saving flow. [Entry form](../../components/WineEntryForm.js) |
| The app displays an offline warning; saving uses server requests. | Do not market an offline journal or guaranteed preservation of unsaved notes. The current website's reassurance is stronger than the evidence supports. [Offline banner](../../components/OfflineBanner.js), [saving](../../lib/visits.js) |

Also distinguish a private journal from on-device processing: “Your notes aren't posted publicly” addresses the social concern. The AI FAQ should explain that relevant journal context and submitted scan images are processed to provide answers, consistent with the existing [privacy content](../../lib/legalContent.js).

The most important product demonstration to validate is a complete interaction: a novice asks for help, identifies something they notice, saves their own reaction, and receives useful guidance. Marketing that sequence well depends on seeing it work.

## 6. Proposed homepage wording

This is a copy draft for the product available in the repository. The stronger promise of guided tasting should be published only after the validation described above. Calls to action must match the actual launch state and destination.

### Opening

**Eyebrow:** Your wine journal & personal AI sommelier

**Headline:** Remember what you tasted. Discover what you like.

**Description:** Keep track of the wines you try and what you thought of them. Ask your personal AI sommelier about flavors, food pairings, and what to explore next—with help informed by your recent tasting notes.

**Reassurance:** For a bottle at home, dinner out, or a day at the winery. No wine expertise needed.

**Before launch:** “Notify me at launch,” once a working signup exists. Until then, keep an accurate coming-soon statement and offer an existing contact route for updates.

**After launch:** “Download free for iPhone,” linked to the actual listing.

**Supporting line:** Free wine journal. Optional Pro subscription. Limited AI use included free.

### The everyday problem

**Heading:** You remember liking it. Now remember the wine.

**Body:** Save the bottle, your rating, and a few words about what stood out. Find it again when you want another bottle—or when someone asks what you enjoyed.

### The journal

**Heading:** Your wines. Your own words.

**Body:** Keep a personal record of what you try, with ratings, notes, and photos. “Loved it with dinner” is a useful place to start. Add more detail whenever you want.

**Scan explanation:** Scan a bottle label or tasting card to help fill in the wine details, then review and save them.

### The sommelier

**Heading:** A little help with every wine question.

**Body:** Ask your AI sommelier to explain a wine term, talk through what you're noticing, or suggest a food pairing. It can draw on your recent ratings and notes to make the conversation more relevant to you.

**Example questions to validate in the app:**

- “I like this wine, but I don't know how to describe it. Can you help?”
- “What does ‘dry’ mean? This wine tastes fruity to me.”
- “What could I serve with this bottle?”
- “Looking at my recent notes, what do the wines I liked have in common?”

**Stronger alternative after guided-tasting validation:** “Your personal guide to tasting wine.” Support it with a captured conversation that shows the guidance being delivered.

### The places

**Heading:** Keep the places that made it memorable.

**Body:** Save winery visits and the wines you tried there. Return to your notes when you're planning another visit or trying to remember a favorite from the trip.

### Bottles at home

**Heading:** Remember what you have at home, too.

**Body:** Track the bottles you own and use Tonight's Pick for a suggestion from your collection, based on the food, occasion, or mood you choose.

**Publication dependency:** state the final Free/Pro access for this feature accurately after resolving the mismatch in section 5. Present drinking windows as estimates, not guarantees of a bottle's condition.

### Free and Pro

**Heading:** Start with a free journal. Get more help with Pro.

**Free description:** Save your tastings, ratings, notes, and photos. Track up to 25 bottles at home, with three label or tasting-card scans and five AI uses each month.

**Pro description:** Get unlimited scans and sommelier messages, track more bottles, and export your journal.

**Price, if the existing launch decision remains:** $9.99/month or $59.99/year. Include trial eligibility, billing, and fair-use wording that matches the actual offer. The website currently advertises a seven-day annual trial; this review did not verify a live store purchase.

Explain whether a cellar AI request spends one of the five free uses. Avoid a visitor interpreting “five messages” as five lengthy conversations or an allowance separate from other AI tools.

### Suggested FAQ additions

**Do I need to know anything about wine?**

No. Start with the wine and whether you enjoyed it. Detailed tasting notes are optional, and you can ask the AI sommelier to explain unfamiliar terms.

**Do I need a cellar or a winery visit?**

No. You can log a bottle at home or a wine you tried over dinner. Places and cellar tracking are there when you want them.

**What makes the sommelier personal?**

It can use a selection of your recent tasting notes and ratings as context. You can also tell it what you like and what you're tasting in the conversation. Tonight's Pick separately uses bottles in your cellar.

**Will it help before I've logged any wines?**

You can ask general wine questions and describe your preferences. Recent saved ratings and notes give it additional context as you use the journal.

**Is it a real person?**

It's an AI wine assistant. It offers explanations and suggestions, and your own taste remains the guide.

### Closing

**Heading:** Make a note of your next favorite.

**Body:** Keep the wine, the memory, and a little help for whatever you're curious about next.

Use the same launch-appropriate action as the opening.

## 7. Voice and reusable copy

Use familiar words, short explanations, and curiosity. The assistant should sound like someone comfortable answering a basic question. Describe actual situations before listing technical wine attributes.

Prefer “what you like,” “bottles at home,” “what you notice,” and “ask a wine question.” Introduce “palate,” “cellar,” and “sommelier” with context. Avoid suggesting that users must acquire refined taste, build an impressive collection, or produce the correct tasting note.

**Short product description:**

> A personal wine journal with an AI sommelier to help you remember what you try and explore what you like.

**Social biography:**

> Remember your wines. Explore your taste. A personal wine journal with a friendly AI sommelier. Coming soon to iPhone.

**Proposed App Store subtitle:**

> Wine notes & an AI sommelier

**Suggested website title:**

> Cork & Note | Wine Journal & Personal AI Sommelier

**Suggested search description:**

> Remember the wines you try, save your ratings and notes, and ask a personal AI sommelier about flavors, pairings, and what to explore next.

**Tasting-room card:**

> Found a favorite today? Remember the wine and what you liked about it. Start your free Cork & Note journal.

**Wine-shop tasting or beginner class:**

> Keep your tasting notes and bring your wine questions along. Cork & Note pairs a personal journal with a friendly AI sommelier.

**Founder introduction:**

> I'm building Cork & Note to help people remember the wines they try and get comfortable asking questions about wine. It combines a personal journal with an AI sommelier that can use recent tasting notes as context.

Add the founder's actual reason for building it once supplied. A specific, true story is more distinctive than generic claims about changing wine discovery.

## 8. Marketing to the first users

Start with a small, observable audience. The objective is to learn which situation creates useful repeat use, then invest in reaching more people in that situation.

| Priority | Channel and action | Message | Evidence to collect |
| --- | --- | --- | --- |
| First | Invite a small group of curious casual drinkers to try their normal wine occasion | Remember the bottle and ask a question | Can they save a useful note, find it later, and get a helpful answer? |
| First | Pilot with two or three accessible Virginia tasting rooms, if that regional plan still stands | Remember today's favorite | Partner-specific visits, signups or installs where measurable, and subsequent use |
| First | Make one short product demonstration each week; reuse it in suitable social channels | Show a familiar problem and the actual app solving it | Relevant questions, qualified visits, and activated users |
| Next | Try one wine-shop tasting or beginner educator partnership | Keep the notes and continue asking questions after the tasting | Whether guided-learning visitors return outside the event |
| Next | Align App Store and website messaging after the interviews | Journal plus approachable assistance | Whether new users correctly understand the app and complete a first useful action |
| Later | Test a small paid campaign once activation and repeat use are understood | Use the strongest demonstrated problem | Acquisition cost per activated and returning user, not just installs |

This is a proposed sequence, not evidence that any channel is guaranteed to work. Founder time and budget should determine the pace. If capacity is limited, prioritize direct observation and one repeatable demonstration format over maintaining several social accounts.

For winery partners, the immediate offer is helping guests keep a useful record of their visit. Do not promise increased sales, new foot traffic, customer analytics, or re-engagement systems that have not been established. Let the assistant support guests' curiosity alongside the staff's expertise.

Give each pilot a distinct campaign link before printing cards. A tracked link measures visits or outbound clicks; it does not automatically prove installs, paid conversion, or retention. Connect later funnel steps only where the actual measurement setup supports it, and use an optional “How did you hear about us?” question as supplementary evidence.

Keep journal content private while measuring events. Counts such as “saved first wine” are sufficient for these marketing questions; collecting people's chat text is unnecessary.

### Four demonstration concepts

1. **The camera-roll problem:** show an old bottle photo and the missing reaction, then show a saved wine with the person's real note. Hook: “A photo helps me remember the label. I also want to remember whether I liked it.”
2. **The vocabulary problem:** ask about a term the person genuinely finds confusing, show the answer, and save their own observation. Hook: “I know I like it. I'm learning how to describe it.”
3. **The tasting-room memory:** show a saved favorite from a visit and retrieve it later. Hook: “This is the one I wanted to remember.”
4. **The useful history:** ask a question about a recent saved rating and show the assistant referencing it accurately. Hook: “My notes give this conversation a starting point.”

Use real responses and real product captures. An illustrative script can help plan a demonstration, but should not be presented as an app transcript or testimonial.

## 9. Pricing and the casual audience

The free journal makes the app relevant to occasional users. Paid value can come from people who repeatedly want assistance or scan enough wines to value convenience. The homepage should give both groups a truthful reason to start.

Keep the existing price as a launch assumption until user evidence supports changing it. A monthly subscription needs repeated usefulness; premium-sounding copy cannot establish that usefulness on its own. Present annual pricing with its actual total charge clearly visible.

The five-use allowance is a question to investigate. A conversational tasting guide may use several exchanges during one occasion. Observe whether people experience a useful result before encountering the limit. If they do not, changing the introductory allowance or trial experience becomes a product experiment worth evaluating against cost. This report does not assume a new allowance has been approved or implemented.

Record whether people upgrade for tasting help, recommendations, scanning convenience, or cellar management. The answer should shape future Pro messaging. Avoid treating free casual users as evidence of failure when they are getting durable journal value.

## 10. A practical first-month validation plan

The sequence below can begin with documents, interviews, and existing app access. Timing is illustrative and should be adjusted to launch readiness.

| Stage | Work | Decision it informs |
| --- | --- | --- |
| Week 1 | Confirm audience, founder story, resources, and offer. Show the current opening and proposed opening to 8–12 prospective users, including casual drinkers and winery visitors. Vary presentation order. | Does the new message communicate both memory and help without implying expertise is required? |
| Week 2 | Observe a handful of complete logging and assistant interactions. Include an empty account, recent notes, and a question about history outside the available context. Capture successful demonstrations. | Which promises are ready to publish, and which need product work first? |
| Week 3 | Use the validated wording consistently when implementation is authorized. Begin a small local pilot and publish the strongest demonstration. Before launch, measure requests for updates; after launch, measure actual product use. | Which source brings people who understand and use the app? |
| Week 4 | Follow up with participants and compare results by entry message and source. | What creates a reason to return, and where should the next month of effort go? |

An 8–12-person interview round is qualitative research, not a statistically reliable conversion experiment. Ask people to explain the app in their own words before asking which headline they prefer.

Useful interview prompts:

- “What do you think this app helps you do?”
- “Tell me about the last time you wanted to remember a wine.”
- “When would you actually open this?”
- “What would you expect the sommelier to know about you?”
- “What is the first question you would ask it?”
- “How would you handle this today without the app?”
- After use: “What would bring you back? What would make the paid version worthwhile?”

### Headline candidates to test

| Candidate | Copy | Hypothesis |
| --- | --- | --- |
| A — recommended starting point | Remember what you tasted. Discover what you like. | A recognizable memory benefit invites casual users; the description establishes personal help |
| B | Your wine journal. Your personal AI sommelier. | Immediate feature clarity makes both parts of the app easy to understand |
| C | Get to know your taste in wine. | Learning and self-discovery create stronger interest for curious users |

Keep the offer and supporting description consistent when comparing headlines. At low traffic, prioritize comprehension and observed use. A few clicks do not establish a winning message.

### Measures that matter

| Measure | Definition and use |
| --- | --- |
| Qualified website response | Launch signup before release; outbound store visit after release. Count separately from an install. |
| Journal activation | A new user saves a wine and records their own rating or reaction. Report against new signed-up users. |
| Assistant activation | A new user receives an answer they find useful. Measure request completion separately from usefulness; validate usefulness through feedback. |
| Combined use | Users who both save a personal reaction and get useful assistance within an initial observation period, such as 14 days. Treat this as a hypothesis about value, not a required path for everyone. |
| Return use | Activated users who retrieve a past wine, save another note, or use assistance within 30 days. Track occasions rather than imposing a daily usage expectation. |
| Paid value | Trial starts, trial-to-paid conversion, and subsequent renewal, interpreted alongside which feature people used. |
| Channel efficiency | Returning activated users relative to money spent and founder time. Early estimates will be noisy. |

These are proposed measures, not assertions that instrumentation exists. No baseline, reliable acquisition cost, or conversion target was available in this review. First establish the baseline, then use comparable cohorts to decide whether a change helped.

## 11. Decisions to finish together

The questions sent with this review cover the primary audience, whether the sommelier is principally a tasting guide or recommendation adviser, brand voice, and current launch resources and user feedback.

Two additional topics can sharpen the next discussion: the specific experience that led the founder to build Cork & Note, and a real example of someone finding its assistant helpful. Those provide the material for a distinctive founder story and credible product proof.

The immediate priorities are to settle the opening promise, validate a useful tasting conversation, reconcile claims about assistant context and plan access, and then carry the approved wording across the website and acquisition materials. The report supplies the starting copy and tests; it does not assume those decisions or changes have already been made.
