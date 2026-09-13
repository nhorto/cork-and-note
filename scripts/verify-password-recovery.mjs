// Live recovery protocol probe. Creates/deletes one disposable account, sends
// no email, and prints no password, API key, recovery link or session token.
// This proves the backend protocol, not inbox delivery or OS link dispatch.
// Run with SUPABASE_ACCESS_TOKEN. The production project is deliberately fixed.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { createClient } from '@supabase/supabase-js';

const ref = 'ixecayqpogkiawempzgc';
const url = `https://${ref}.supabase.co`;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/api-keys`, {
  headers: { Authorization: `Bearer ${token}` },
});
if (!response.ok) throw new Error(`Cannot read project keys: HTTP ${response.status}`);
const keys = await response.json();
const serviceKey = keys.find((key) => key.name === 'service_role')?.api_key;
const anonKey = keys.find((key) => key.name === 'anon')?.api_key;
if (!serviceKey || !anonKey) throw new Error('Project API keys unavailable');
const admin = createClient(url, serviceKey, options);
const client = createClient(url, anonKey, options);
const source = readFileSync(new URL('../lib/passwordRecovery.js', import.meta.url), 'utf8');
const { establishPasswordRecovery, parseRecoveryParams } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
);
const nonce = randomBytes(12).toString('hex');
const email = `recovery-probe-${nonce}@example.com`;
const oldPassword = `Old-${randomBytes(20).toString('hex')}-Aa1!`;
const newPassword = `New-${randomBytes(20).toString('hex')}-Aa1!`;
const results = { project: ref, emailSent: false, osLinkDispatchTested: false };
let userId;
const requireOk = (condition, message) => { if (!condition) throw new Error(message); };
try {
  const created = await admin.auth.admin.createUser({
    email, password: oldPassword, email_confirm: true,
    user_metadata: { name: 'Disposable recovery probe' },
  });
  requireOk(!created.error && created.data.user?.id, 'Could not create disposable account');
  userId = created.data.user.id;

  const untrusted = await admin.auth.admin.generateLink({
    type: 'recovery', email, options: { redirectTo: 'https://invalid.example/reset-password' },
  });
  requireOk(!untrusted.error, 'Could not check redirect allow-list');
  const untrustedAction = new URL(untrusted.data.properties.action_link);
  requireOk(untrustedAction.searchParams.get('redirect_to') === 'https://cork-and-note.vercel.app', 'Untrusted redirect was not rejected');
  results.untrustedRedirectRejected = true;

  const generated = await admin.auth.admin.generateLink({
    type: 'recovery', email, options: { redirectTo: 'corkandnote://reset-password' },
  });
  requireOk(!generated.error, 'Could not generate recovery link');
  const action = generated.data.properties.action_link;
  const actionUrl = new URL(action);
  requireOk(actionUrl.origin === url && actionUrl.searchParams.get('redirect_to') === 'corkandnote://reset-password', 'Recovery redirect mismatch');
  const verification = await fetch(action, { redirect: 'manual' });
  const location = verification.headers.get('location');
  requireOk(location?.startsWith('corkandnote://reset-password#'), 'Verification did not return a mobile recovery link');
  const session = await establishPasswordRecovery(location, client.auth);
  requireOk(session.user.id === userId, 'Recovery session belongs to wrong account');
  results.mobileRecoverySession = true;

  const changed = await client.auth.updateUser({ password: newPassword });
  requireOk(!changed.error, 'Password update failed');
  await client.auth.signOut();
  const oldLogin = await client.auth.signInWithPassword({ email, password: oldPassword });
  requireOk(!!oldLogin.error, 'Old password still authenticates');
  const newLogin = await client.auth.signInWithPassword({ email, password: newPassword });
  requireOk(!newLogin.error && newLogin.data.user?.id === userId, 'New password does not authenticate');
  results.oldPasswordRejected = true;
  results.newPasswordAccepted = true;

  const replay = await fetch(action, { redirect: 'manual' });
  const replayLocation = replay.headers.get('location');
  requireOk(replayLocation && new URL(replayLocation).hash.includes('error=') && !parseRecoveryParams(replayLocation), 'Consumed recovery link was reusable');
  results.consumedLinkRejected = true;
} catch (error) {
  console.error('Recovery probe failed:', error.message);
  throw error;
} finally {
  if (userId) {
    // Use the real deletion flow: it removes profile-owned rows before Auth.
    // Establish a fresh fixture-only session even if an earlier step failed.
    const cleanupLink = await admin.auth.admin.generateLink({ type: 'recovery', email });
    requireOk(!cleanupLink.error, 'Could not establish cleanup session');
    const cleanupSession = await client.auth.verifyOtp({
      token_hash: cleanupLink.data.properties.hashed_token, type: 'recovery',
    });
    requireOk(!cleanupSession.error && cleanupSession.data.user?.id === userId, 'Cleanup session mismatch');
    const deleted = await client.functions.invoke('delete-account', { body: {} });
    requireOk(!deleted.error && deleted.data?.success, 'Disposable account cleanup failed');
    const lookup = await admin.auth.admin.getUserById(userId);
    requireOk(!!lookup.error && !lookup.data.user, 'Disposable auth account remains');
    const profile = await admin.from('users').select('id').eq('id', userId);
    requireOk(!profile.error && profile.data.length === 0, 'Disposable profile remains');
    results.cleanupVerified = true;
  }
}
console.log(JSON.stringify(results, null, 2));
