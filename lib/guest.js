// lib/guest.js — guest accounts (epic #316, App Review Guideline 5.1.1).
//
// Apple rejected 1.0 because every launch hit a login wall. A guest is a
// Supabase anonymous user: a real auth.users row (real id, no email,
// is_anonymous = true) minted on first launch, so the app opens straight onto
// Home and everything a guest does is saved under that id exactly like a
// signed-in user. "Create account" then LINKS an email onto that same row
// (id preserved, nothing to migrate); signing IN to an account that already
// exists MERGES the guest's rows into it via a one-shot claim token, so a
// guest who logs a few wines on a new phone and then remembers their login
// does not lose them.
//
// Every helper takes the Supabase client as an argument so it can be tested
// against a fake without mocking the module.
import AsyncStorage from '@react-native-async-storage/async-storage';

/** True for an anonymous (guest) Supabase user. */
export const isGuestUser = (user) => user?.is_anonymous === true;

/** Mint a guest session. Fails offline; the caller decides what to show. */
export async function startGuestSession(supabase) {
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) return { error, session: null, user: null };
    return { error: null, session: data?.session ?? null, user: data?.user ?? null };
  } catch (error) {
    return { error, session: null, user: null };
  }
}

/**
 * Turn the current guest session into a real account. The row keeps its id,
 * so every tasting, bottle, and chat the guest made is already theirs.
 *
 * The project auto-confirms email, so the link lands immediately and a
 * password sign-in works straight away (verified live 2026-09-21). An address
 * that already belongs to someone comes back as the same "User already
 * registered" message the register screen already handles.
 */
export async function linkGuestAccount(supabase, { email, password, name }) {
  const { data, error } = await supabase.auth.updateUser({
    email,
    password,
    data: { name },
  });
  if (error) {
    const taken =
      error.code === 'email_exists' || /already (been )?registered/i.test(error.message || '');
    return {
      error: taken ? { ...error, message: 'User already registered' } : error,
      data: null,
    };
  }
  return { error: null, data };
}

/**
 * Sign in with a password from (possibly) a guest session. When `guestId` is
 * set, a claim token is stamped while still a guest, and after the sign-in
 * succeeds the guest's rows are merged into the signed-in account. The merge
 * is best-effort: a failure there must never turn a successful sign-in into
 * an error, so it is reported in `merged` rather than thrown.
 */
export async function signInFromGuest(supabase, { guestId = null, email, password }) {
  let token = null;
  if (guestId) {
    try {
      const { data } = await supabase.rpc('stamp_guest_claim');
      token = data ?? null;
    } catch {
      token = null;
    }
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error, data: null, merged: null };

  let merged = null;
  const signedInId = data?.user?.id ?? null;
  if (guestId && token && signedInId && signedInId !== guestId) {
    try {
      const res = await supabase.rpc('merge_guest_account', {
        p_guest_id: guestId,
        p_token: token,
      });
      merged = res.error ? { error: res.error.message } : { moved: res.data ?? {} };
    } catch (e) {
      merged = { error: e?.message || 'merge failed' };
    }
  }
  return { error: null, data, merged };
}

// ── Nudge bookkeeping (per install, AsyncStorage) ────────────────────────────
// The first-tasting sheet is shown ONCE, ever: log-session marks it pending
// when a guest's first save lands, Home takes it on the next focus.
const FIRST_LOG_KEY = 'cn_guest_first_log'; // absent | 'pending' | 'shown'
const CARD_KEY = 'cn_guest_card_dismissed';

/** Called after a guest saves a tasting. Returns true the first time only. */
export async function noteGuestFirstLog() {
  try {
    if (await AsyncStorage.getItem(FIRST_LOG_KEY)) return false;
    await AsyncStorage.setItem(FIRST_LOG_KEY, 'pending');
    return true;
  } catch {
    return false;
  }
}

/** Consume the pending first-log nudge. True exactly once. */
export async function takeGuestFirstLogNudge() {
  try {
    if ((await AsyncStorage.getItem(FIRST_LOG_KEY)) !== 'pending') return false;
    await AsyncStorage.setItem(FIRST_LOG_KEY, 'shown');
    return true;
  } catch {
    return false;
  }
}

export async function isGuestCardDismissed() {
  try {
    return (await AsyncStorage.getItem(CARD_KEY)) === 'yes';
  } catch {
    return false;
  }
}

export async function dismissGuestCard() {
  try {
    await AsyncStorage.setItem(CARD_KEY, 'yes');
  } catch {
    // Best effort: the card simply shows again next time.
  }
}
