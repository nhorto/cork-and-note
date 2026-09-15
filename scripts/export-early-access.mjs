// Export the private website roster to Downloads; never print contact records.
// --android-invitations selects new, consenting Android testing requests only.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required.');
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--android-invitations') || args.length > 1) {
  throw new Error('Usage: node scripts/export-early-access.mjs [--android-invitations]');
}
const invitations = args.includes('--android-invitations');
const filter = invitations
  ? "where platform = 'Android' and interest = 'testing' and android_commitment = true and status = 'requested'"
  : '';
const response = await fetch('https://api.supabase.com/v1/projects/ixecayqpogkiawempzgc/database/query', {
  method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `select id, created_at, email, platform, interest, android_commitment, status, attribution from public.early_access_requests ${filter} order by created_at desc limit 5000` }),
});
if (!response.ok) throw new Error(`Roster export failed: HTTP ${response.status}`);
const rows = await response.json();
const columns = ['id','created_at','email','platform','interest','android_commitment','status','attribution'];
const cell = value => {
  let text = typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const label = invitations ? 'Android-Invitation-Candidates' : 'Early-Access-Roster';
const path = join(homedir(), 'Downloads', `Cork-and-Note-${label}-${new Date().toISOString().replaceAll(':','-')}.csv`);
writeFileSync(path, [columns.join(','), ...rows.map(row => columns.map(key => cell(row[key])).join(','))].join('\n')+'\n', { mode: 0o600, flag: 'wx' });
console.log(`Exported ${rows.length} requests to ${path}. Keep this contact file private.`);
if (invitations) console.log('Candidates only: no Play access added, messages sent, or request statuses changed. Recheck consent/status before sending.');
if (rows.length === 5000) console.log('Export reached the 5,000-row limit; this may be a partial roster.');
