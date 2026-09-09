// lib/purchases.js — the only place that talks to the RevenueCat SDK.
//
// Everything here is defensive on purpose. react-native-purchases is a NATIVE
// module: it is absent on web, absent in Expo Go, and absent in every build made
// before this PR. The app must degrade to "free tier, no paywall" in all of
// those cases rather than crash on boot, so every entry point catches and every
// getter has a safe answer.
//
// The public SDK key is read from the app config (app.config.js ← EAS env), the
// same route GOOGLE_MAPS_API_KEY takes. It is a publishable key and safe to ship,
// but it is still not hardcoded in a committed file — an unset key simply leaves
// purchases unconfigured.
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PRO_ENTITLEMENT_ID } from './pro';

let sdk;
let ui;
let configured = false;

/** Lazily require the native modules; null once we know they are unavailable. */
function getSdk() {
  if (sdk !== undefined) return sdk;
  if (Platform.OS === 'web') {
    sdk = null;
    return sdk;
  }
  try {
    sdk = require('react-native-purchases').default ?? null;
  } catch {
    sdk = null;
  }
  return sdk;
}

function getUi() {
  if (ui !== undefined) return ui;
  if (!getSdk()) {
    ui = null;
    return ui;
  }
  try {
    ui = require('react-native-purchases-ui').default ?? null;
  } catch {
    ui = null;
  }
  return ui;
}

function apiKey() {
  const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {};
  // iOS is the only store at launch (launch plan §2.0, "platform: iOS only").
  return Platform.OS === 'ios' ? extra.revenueCatIosKey || null : null;
}

/** True when the SDK is present AND keyed — the only state in which purchases work. */
export function purchasesAvailable() {
  return Boolean(getSdk() && apiKey());
}

/**
 * Configure the SDK once, at startup. Safe to call repeatedly.
 *
 * We deliberately configure WITHOUT an app user id and call logIn later: at boot
 * we may not know who the user is yet, and RevenueCat's own guidance is to
 * configure anonymously and identify afterwards.
 */
export async function configurePurchases() {
  if (configured) return true;
  const Purchases = getSdk();
  const key = apiKey();
  if (!Purchases || !key) return false;

  try {
    Purchases.configure({ apiKey: key });
    configured = true;
    return true;
  } catch (err) {
    console.warn('RevenueCat configure failed:', err?.message);
    return false;
  }
}

/**
 * Bind purchases to a Supabase user id.
 *
 * This is what makes the webhook's app_user_id a UUID we can write an
 * entitlements row for, and what stops one device's purchase following the next
 * person who signs in on it.
 */
export async function identifyPurchaser(userId) {
  const Purchases = getSdk();
  if (!Purchases || !configured || !userId) return null;
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    return customerInfo;
  } catch (err) {
    console.warn('RevenueCat logIn failed:', err?.message);
    return null;
  }
}

/**
 * Detach purchases from the signed-out account.
 *
 * Without this, entitlements leak: RevenueCat keeps the previous user's customer
 * info cached, so the next account signed in on the same device would read as Pro
 * until something refreshed it.
 */
export async function forgetPurchaser() {
  const Purchases = getSdk();
  if (!Purchases || !configured) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    // logOut throws when already anonymous; that is the state we wanted anyway.
    console.warn('RevenueCat logOut skipped:', err?.message);
  }
}

/** Read Pro status off a CustomerInfo object. Pure enough to reason about. */
export function proFromCustomerInfo(customerInfo) {
  const entitlement = customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
  if (!entitlement) return { isPro: false, expiresAt: null, willRenew: false };
  return {
    isPro: true,
    expiresAt: entitlement.expirationDate ?? null,
    willRenew: entitlement.willRenew ?? false,
  };
}

/** Current Pro status from the SDK's cache (refreshed by the SDK as needed). */
export async function fetchProStatus() {
  const Purchases = getSdk();
  if (!Purchases || !configured) return { isPro: false, expiresAt: null, willRenew: false };
  try {
    return proFromCustomerInfo(await Purchases.getCustomerInfo());
  } catch (err) {
    console.warn('RevenueCat getCustomerInfo failed:', err?.message);
    return { isPro: false, expiresAt: null, willRenew: false };
  }
}

/** Subscribe to entitlement changes (purchase, renewal, expiry). Returns an unsubscribe. */
export function addProStatusListener(listener) {
  const Purchases = getSdk();
  if (!Purchases || !configured) return () => {};
  try {
    const remove = Purchases.addCustomerInfoUpdateListener((info) =>
      listener(proFromCustomerInfo(info))
    );
    return typeof remove === 'function' ? remove : () => {};
  } catch (err) {
    console.warn('RevenueCat listener failed:', err?.message);
    return () => {};
  }
}

/** The `default` offering's packages, for the paywall to render. */
export async function fetchOffering() {
  const Purchases = getSdk();
  if (!Purchases || !configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings?.current ?? offerings?.all?.default ?? null;
  } catch (err) {
    console.warn('RevenueCat getOfferings failed:', err?.message);
    return null;
  }
}

/** Buy a package. Resolves { isPro, cancelled } — a user cancel is not an error. */
export async function purchasePackage(pkg) {
  const Purchases = getSdk();
  if (!Purchases || !configured || !pkg) {
    return { isPro: false, cancelled: false, error: 'Purchases are unavailable.' };
  }
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { ...proFromCustomerInfo(customerInfo), cancelled: false, error: null };
  } catch (err) {
    if (err?.userCancelled) return { isPro: false, cancelled: true, error: null };
    console.warn('RevenueCat purchase failed:', err?.message);
    return { isPro: false, cancelled: false, error: err?.message || 'Purchase failed.' };
  }
}

/**
 * Restore Purchases — required on the paywall and in Settings by guideline 3.1.2,
 * and the only recovery for a user who reinstalled or switched devices.
 */
export async function restorePurchases() {
  const Purchases = getSdk();
  if (!Purchases || !configured) {
    return { isPro: false, error: 'Purchases are unavailable on this device.' };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { ...proFromCustomerInfo(customerInfo), error: null };
  } catch (err) {
    console.warn('RevenueCat restore failed:', err?.message);
    return { isPro: false, error: err?.message || 'Could not restore purchases.' };
  }
}

/**
 * Present a RevenueCat-hosted (Paywalls v2) paywall, if one is designed in the
 * dashboard. Returns false when there is none, which is the app's cue to fall
 * back to its own paywall screen — the in-app one is what actually ships today.
 */
export async function presentHostedPaywall() {
  const RevenueCatUI = getUi();
  if (!RevenueCatUI || !configured) return false;
  try {
    const result = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: PRO_ENTITLEMENT_ID,
    });
    return result !== 'NOT_PRESENTED' && result !== 'ERROR';
  } catch (err) {
    console.warn('RevenueCat hosted paywall unavailable:', err?.message);
    return false;
  }
}
