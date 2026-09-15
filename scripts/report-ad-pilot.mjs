// Read aggregate signup counts only. No contact details, messages or account changes.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--spend' || !/^\d+(\.\d{1,2})?$/.test(args[1]))) {
  throw new Error('Usage: node scripts/report-ad-pilot.mjs [--spend TOTAL_PILOT_SPEND_USD]');
}
const spend = args.length ? Number(args[1]) : null;
if (spend !== null && !Number.isSafeInteger(Math.round(spend * 100))) throw new Error('Invalid spend.');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required.');
const query = `
select
  case when attribution->>'utm_source' = 'facebook'
    and attribution->>'utm_medium' = 'paid_social'
    and attribution->>'utm_campaign' = 'cn_android_early_access_202609'
    then 'pilot' else 'other' end as source,
  case when attribution->>'utm_content' in
    ('01_journal_feed','01_journal_story','02_sommelier_feed','02_sommelier_story',
     '07_own_words_feed','07_own_words_story')
    then attribution->>'utm_content' else 'other_or_missing' end as creative,
  count(*)::int as requests,
  count(*) filter (where status = 'withdrawn')::int as withdrawn,
  count(*) filter (where platform = 'Android' and interest = 'testing'
    and android_commitment and status <> 'withdrawn')::int as eligible_android,
  count(*) filter (where platform = 'Android' and interest = 'testing'
    and android_commitment and status = 'requested')::int as awaiting_invitation
from public.early_access_requests group by 1, 2 order by 1, 2`;
const response = await fetch('https://api.supabase.com/v1/projects/ixecayqpogkiawempzgc/database/query', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});
if (!response.ok) throw new Error(`Signup summary failed: HTTP ${response.status}`);
const rows = await response.json();
if (!Array.isArray(rows)) throw new Error('Unexpected signup summary response.');
const pilot = rows.filter(row => row.source === 'pilot');
const sum = (items, key) => items.reduce((total, row) => total + Number(row[key]), 0);
const eligible = sum(pilot, 'eligible_android');
const labels = {
  '01_journal_feed': 'Journal / Feed', '01_journal_story': 'Journal / Story',
  '02_sommelier_feed': 'Sommelier / Feed', '02_sommelier_story': 'Sommelier / Story',
  '07_own_words_feed': 'Your own words / Feed (backup)', '07_own_words_story': 'Your own words / Story (backup)',
  'other_or_missing': 'Other or missing creative label',
};
const table = Object.entries(labels).map(([key, label]) => {
  const group = pilot.filter(row => row.creative === key);
  return `| ${label} | ${sum(group, 'requests')} | ${sum(group, 'eligible_android')} | ${sum(group, 'awaiting_invitation')} | ${sum(group, 'withdrawn')} |`;
}).join('\n');
const checkedAt = new Date().toISOString();
const money = value => `$${value.toFixed(2)}`;
const report = `# Cork & Note — Android signup pilot scorecard

Generated ${checkedAt}. This is a snapshot; rerun the report to refresh it.

- Pilot media budget: $75 lifetime. Monthly reserve: $225.
- Actual Meta spend: ${spend === null ? 'not supplied; no spend or delivery is inferred from signup counts' : money(spend) + ' (manually supplied, not fetched from Meta)'}.
- Pilot-tagged requests: ${sum(pilot, 'requests')}.
- Eligible Android testing requests, excluding withdrawn: ${eligible}.
- Cost per eligible request: ${spend === null ? 'not calculated without actual Meta spend' : eligible === 0 ? 'not calculable: zero eligible requests' : money(spend / eligible)}.
- Other or untagged requests: ${sum(rows.filter(row => row.source !== 'pilot'), 'requests')}.

| Ad label | Saved requests | Eligible Android | Awaiting invitation | Withdrawn |
| --- | ---: | ---: | ---: | ---: |
${table}

Eligible means Android testing selected, the 14-day commitment recorded, and not withdrawn. It does not establish a unique person, a valid Play account, enrollment, installation or activity. Launch-only and iPhone requests do not count toward this metric. Awaiting invitation is a subset with status requested.

Campaign labels come from the signup URL. They are not independent proof of Meta delivery; forwarded links can retain labels. Duplicate email/platform/interest requests retain their original attribution. Compare these counts with Meta reporting and the private tester roster before making budget decisions.

## Complete the review with Meta and Google

1. In Meta, select only campaign CN | Android early access | US 21+ | $75 pilot and use its full lifetime reporting range. Record delivery status, amount spent, impressions, outbound clicks and landing page views. Use actual spend from that same campaign with --spend.
2. Compare Journal and Sommelier using both spend and eligible requests. This report does not choose a winning ad from request counts alone. The feed/story labels identify the links used; use Meta's placement reporting for actual delivery placement.
3. Review eligible requests privately and track invitations, actual Google opt-ins and participation separately. No Pixel or CAPI conversion tracking is configured, so Meta is optimizing landing page views rather than completed signups.
4. Keep the combined pilot within $75. Adding budget or extending delivery requires a deliberate campaign update; the $225 reserve is not automatically allocated. Resolve broken signup or misleading access wording before continuing delivery.

No publication, billing verification, invitations, status updates or unattended monitoring are performed by this report.
`;
const output = join(homedir(), 'Downloads', 'Cork-and-Note-Early-Access-Campaign', 'PILOT-SCORECARD.md');
writeFileSync(output, report, { mode: 0o600 });
console.log(`Saved aggregate scorecard: ${output}`);
console.log(`Pilot-tagged requests: ${sum(pilot, 'requests')}; eligible Android requests: ${eligible}.`);
