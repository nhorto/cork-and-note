// lib/notifications.js — Restrained drink-soon / past-peak notifications (Epic #6, R7, issue #57)
//
// Philosophy (research §2.9): restraint is the whole game. 46% of users disable
// push after 2–5 *irrelevant* notifications/week. So this module is deliberately
// conservative:
//   • EVENT-DRIVEN  — we only notify when bottles *newly* cross into peak / past-peak,
//     never on a fixed drip.
//   • BATCHED       — one nudge ("3 bottles just entered their peak"), never one per bottle.
//   • EARLY-EVENING — delivered at a user-chosen local-timezone hour (default 6pm),
//     when a wine lover is actually deciding what to open.
//   • DE-DUPED      — each bottle is only ever announced once per status transition
//     (we persist already-notified keys in AsyncStorage).
//   • OPT-IN        — push defaults OFF. The default surface for "drink soon" is the
//     in-app Home "Ready to Drink" strip (#54). Push is reserved for genuine
//     peak-entry milestones and is only armed when the user turns it on.
//
// Everything here is GUARDED: it must never crash the app and must no-op cleanly on
// web, in environments without the native module, or when permission is denied.
// No DB migration — prefs + de-dup ledger live entirely in AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { cellarService, drinkWindowStatus, drinkWindowMeta } from './cellar';

// expo-notifications / expo-device are native modules. Import defensively so that
// a missing module (e.g. running on web, or before a dev-build rebuild) degrades
// to a no-op instead of throwing at import time.
let Notifications = null;
let Device = null;
try {
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}
try {
  Device = require('expo-device');
} catch {
  Device = null;
}

// ── Storage keys ────────────────────────────────────────────────────────────
const PREFS_KEY = 'cork:notifPrefs:v1';
// Ledger of "already announced" bottle/status pairs so we never re-notify about
// the same transition. Shape: { [`${bottleId}:${status}`]: ISO-timestamp }.
const NOTIFIED_KEY = 'cork:notifLedger:v1';
// The id of the single pending scheduled reminder, so we can cancel/replace it.
const SCHEDULED_ID_KEY = 'cork:notifScheduledId:v1';

// Android channel for these gentle cellar reminders.
const ANDROID_CHANNEL_ID = 'cellar-reminders';

// ── Default preferences (intentionally restrained) ──────────────────────────
// Push is OFF by default: the in-app Home "Ready to Drink" strip is the default
// surface, and we only ask the user to opt into push for real peak milestones.
export const DEFAULT_PREFS = {
  enabled: false,        // master push toggle — OFF by default (R7)
  notifyPeakEntry: true, // "N bottles just entered their peak" (the headline event)
  notifyPastPeak: true,  // occasional loss-aversion "past peak" nudge
  hour: 18,              // early-evening local hour (24h) — 6pm
  minute: 0,
};

// The two derived drink-window statuses we treat as notifiable "events".
// (See drinkWindowStatus in lib/cellar.js: too_young | ready | drink_up | past_peak.)
const PEAK_ENTRY_STATUSES = ['ready', 'drink_up']; // bottle has entered its drinking window
const PAST_PEAK_STATUS = 'past_peak';

function isWeb() {
  return Platform.OS === 'web';
}

function available() {
  // Native module present and we're not on web.
  return !!Notifications && !isWeb();
}

// ── Preferences (AsyncStorage) ──────────────────────────────────────────────
export async function getPrefs() {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch (e) {
    console.warn('notifications.getPrefs failed, using defaults:', e?.message);
    return { ...DEFAULT_PREFS };
  }
}

export async function setPrefs(next) {
  const merged = { ...DEFAULT_PREFS, ...next };
  try {
    await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(merged));
  } catch (e) {
    console.warn('notifications.setPrefs failed:', e?.message);
  }
  return merged;
}

// ── De-dup ledger (AsyncStorage) ────────────────────────────────────────────
async function getLedger() {
  try {
    const raw = await AsyncStorage.getItem(NOTIFIED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveLedger(ledger) {
  try {
    await AsyncStorage.setItem(NOTIFIED_KEY, JSON.stringify(ledger));
  } catch (e) {
    console.warn('notifications.saveLedger failed:', e?.message);
  }
}

// Clear the de-dup ledger (e.g. on sign-out, so a different user starts fresh).
export async function resetLedger() {
  try {
    await AsyncStorage.removeItem(NOTIFIED_KEY);
  } catch {
    // ignore
  }
}

function ledgerKey(bottleId, status) {
  return `${bottleId}:${status}`;
}

// ── Notification handler ────────────────────────────────────────────────────
// Call ONCE at app start (from app/_layout.js). Controls how a notification is
// presented while the app is foregrounded. Guarded: no-op without the module.
let handlerSet = false;
export function setNotificationHandler() {
  if (!available() || handlerSet) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false, // calm: no sound for ambient cellar reminders
        shouldSetBadge: false,
      }),
    });
    handlerSet = true;
  } catch (e) {
    console.warn('setNotificationHandler failed:', e?.message);
  }
}

async function ensureAndroidChannel() {
  if (!available() || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Cellar reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: [0, 200],
      enableVibrate: true,
    });
  } catch (e) {
    console.warn('ensureAndroidChannel failed:', e?.message);
  }
}

// ── Permissions ─────────────────────────────────────────────────────────────
// Returns true only on a real device where the user granted permission.
// Never throws.
export async function requestPermissions() {
  if (!available()) return false;
  // Push only works on physical devices; expo-device lets us detect simulators.
  if (Device && Device.isDevice === false) return false;
  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status === 'granted') await ensureAndroidChannel();
    return status === 'granted';
  } catch (e) {
    console.warn('requestPermissions failed:', e?.message);
    return false;
  }
}

export async function getPermissionStatus() {
  if (!available()) return 'unavailable';
  if (Device && Device.isDevice === false) return 'unavailable';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status; // 'granted' | 'denied' | 'undetermined'
  } catch {
    return 'unavailable';
  }
}

// ── Core: compute the batched, de-duped "newly notable" set ─────────────────
// Reads the cellar (read-only) and returns the bottles that have NEWLY crossed
// into a notifiable status since we last announced them, split by event type.
// Pure-ish: it reads the ledger but does not mutate it (caller decides whether to
// commit, e.g. only after a notification is actually scheduled).
export async function computeNotableBottles(prefs) {
  const result = { peakEntry: [], pastPeak: [], all: [] };
  try {
    const { success, bottles } = await cellarService.getCellar();
    if (!success || !Array.isArray(bottles)) return result;

    const ledger = await getLedger();
    const year = new Date().getFullYear();

    for (const b of bottles) {
      // Recompute status from raw window fields so we don't depend on annotate().
      const status = drinkWindowStatus(b.drink_from, b.drink_by, year);
      if (!status) continue;

      const isPeakEntry =
        prefs.notifyPeakEntry && PEAK_ENTRY_STATUSES.includes(status);
      const isPastPeak = prefs.notifyPastPeak && status === PAST_PEAK_STATUS;
      if (!isPeakEntry && !isPastPeak) continue;

      // De-dup: only "new" if we haven't announced this bottle at this status.
      if (ledger[ledgerKey(b.id, status)]) continue;

      const entry = {
        id: b.id,
        status,
        name: b.wine_name || b.producer || 'A bottle',
        vintage: b.vintage || null,
      };
      result.all.push(entry);
      if (isPeakEntry) result.peakEntry.push(entry);
      else if (isPastPeak) result.pastPeak.push(entry);
    }
  } catch (e) {
    console.warn('computeNotableBottles failed:', e?.message);
  }
  return result;
}

// Mark a set of bottle entries as announced (commit to the ledger).
async function commitNotified(entries) {
  if (!entries.length) return;
  const ledger = await getLedger();
  const now = new Date().toISOString();
  for (const e of entries) ledger[ledgerKey(e.id, e.status)] = now;
  await saveLedger(ledger);
}

// ── Copy (calm + specific) ──────────────────────────────────────────────────
// Build the single batched notification body. Peak-entry leads (the positive,
// act-now event); past-peak is folded in as a gentle, occasional addendum.
function buildMessage({ peakEntry, pastPeak }) {
  // Prefer the peak-entry headline; this is the milestone push is reserved for.
  if (peakEntry.length > 0) {
    const n = peakEntry.length;
    const title = n === 1 ? 'A bottle just hit its peak' : `${n} bottles just hit their peak`;
    let body;
    if (n === 1) {
      const w = peakEntry[0];
      body = `${labelBottle(w)} is ready to enjoy. A good night to open it.`;
    } else {
      body = `${n} wines in your cellar are entering their drinking window. Time to plan a few openings.`;
    }
    // Fold in a gentle past-peak note if there's also something slipping away.
    if (pastPeak.length > 0) {
      const p = pastPeak.length;
      body += p === 1
        ? ` (And one bottle is slipping past its peak — worth opening soon.)`
        : ` (And ${p} are slipping past their peak — worth opening soon.)`;
    }
    return { title, body };
  }

  // Past-peak only: the loss-aversion nudge, kept soft.
  if (pastPeak.length > 0) {
    const p = pastPeak.length;
    const title = p === 1 ? 'A bottle is past its peak' : `${p} bottles are past their peak`;
    const body = p === 1
      ? `${labelBottle(pastPeak[0])} may be fading. Tonight could be the night.`
      : `A few wines are drinking down from their best. Consider opening one soon.`;
    return { title, body };
  }

  return null;
}

function labelBottle(e) {
  const meta = drinkWindowMeta(e.status);
  void meta; // status meta available if richer copy is ever needed
  return e.vintage ? `${e.vintage} ${e.name}` : e.name;
}

// ── Scheduling ──────────────────────────────────────────────────────────────
// Compute the next early-evening local Date for the given hour/minute. If that
// time has already passed today, schedule for tomorrow.
function nextDeliveryDate(hour, minute) {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

async function cancelPending() {
  if (!available()) return;
  try {
    const id = await AsyncStorage.getItem(SCHEDULED_ID_KEY);
    if (id) {
      await Notifications.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(SCHEDULED_ID_KEY);
    }
  } catch (e) {
    console.warn('cancelPending failed:', e?.message);
  }
}

// ── Public entry point: check the cellar and (re)schedule a single nudge ─────
// Safe to call on every app-foreground. It:
//   1. no-ops unless push is enabled, the module is present, and permission is granted;
//   2. computes the batched, de-duped notable set;
//   3. cancels any stale pending nudge;
//   4. if there's something new, schedules ONE early-evening local reminder and
//      records those bottles in the de-dup ledger so they aren't re-announced.
// Returns a small summary for callers/tests. Never throws.
export async function checkAndReschedule({ force = false } = {}) {
  try {
    if (!available()) return { scheduled: false, reason: 'unavailable' };

    const prefs = await getPrefs();
    if (!prefs.enabled) {
      // Push is off: make sure nothing stale is queued, then stop.
      await cancelPending();
      return { scheduled: false, reason: 'disabled' };
    }

    const status = await getPermissionStatus();
    if (status !== 'granted') {
      await cancelPending();
      return { scheduled: false, reason: 'no-permission' };
    }

    const notable = await computeNotableBottles(prefs);
    const message = buildMessage(notable);

    // Always clear the prior pending one so we never double-fire.
    await cancelPending();

    if (!message) {
      return { scheduled: false, reason: 'nothing-new', count: 0 };
    }

    const when = nextDeliveryDate(prefs.hour ?? DEFAULT_PREFS.hour, prefs.minute ?? 0);
    const trigger = force
      ? null // fire immediately (used for a "send a test" affordance)
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: when,
          channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
        };

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: message.title,
        body: message.body,
        data: { kind: 'cellar-reminder' },
      },
      trigger,
    });
    if (id && !force) await AsyncStorage.setItem(SCHEDULED_ID_KEY, id);

    // Commit the announced bottles so the next check won't repeat them.
    await commitNotified(notable.all);

    return {
      scheduled: true,
      id,
      when: force ? 'now' : when.toISOString(),
      count: notable.all.length,
      peakEntry: notable.peakEntry.length,
      pastPeak: notable.pastPeak.length,
    };
  } catch (e) {
    console.warn('checkAndReschedule failed:', e?.message);
    return { scheduled: false, reason: 'error', error: e?.message };
  }
}

// Convenience for a "Send a test notification" button on the settings screen.
// Requires push enabled + permission; fires immediately, bypassing de-dup.
export async function sendTestNotification() {
  if (!available()) return false;
  const granted = await requestPermissions();
  if (!granted) return false;
  try {
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Cork & Note',
        body: 'This is how a gentle cellar reminder will look.',
        data: { kind: 'cellar-reminder-test' },
      },
      trigger: null,
    });
    return true;
  } catch (e) {
    console.warn('sendTestNotification failed:', e?.message);
    return false;
  }
}

// Enable push: request permission, persist the pref, and arm the first check.
// Returns the granted boolean so the UI can reflect a denial.
export async function enablePush(partialPrefs = {}) {
  const granted = await requestPermissions();
  await setPrefs({ ...partialPrefs, enabled: granted });
  if (granted) await checkAndReschedule();
  return granted;
}

// Disable push: persist the pref and tear down any pending reminder.
export async function disablePush() {
  await setPrefs({ enabled: false });
  await cancelPending();
}
