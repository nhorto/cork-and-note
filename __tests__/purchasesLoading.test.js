import Purchases from 'react-native-purchases';
import { fetchOffering, fetchTrialEligibility } from '../lib/purchases';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { revenueCatIosKey: 'appl_test' } } } }));
jest.mock('react-native-purchases', () => ({ __esModule: true, default: {
  configure: jest.fn(),
  getOfferings: jest.fn(),
  checkTrialOrIntroductoryPriceEligibility: jest.fn(),
} }));
// Platform.OS is a getter on the real module, so tests that need to run "on
// Android" swap in a plain mutable object instead.
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  __esModule: true,
  default: { OS: 'ios', select: (specifics) => specifics.ios ?? specifics.default },
}));

it('loads plans even before the provider has configured purchases', async () => {
  const current = { availablePackages: [{ product: { identifier: 'pro_annual' } }] };
  Purchases.getOfferings.mockResolvedValue({ current });
  await expect(fetchOffering()).resolves.toBe(current);
  expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'appl_test' });
});

it('allows a new attempt after a store failure and distinguishes an empty offering', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  Purchases.getOfferings.mockRejectedValueOnce(new Error('Network unavailable'));
  await expect(fetchOffering()).rejects.toMatchObject({ code: 'STORE_PLANS_ERROR' });
  Purchases.getOfferings.mockResolvedValueOnce({ current: { availablePackages: [] } });
  await expect(fetchOffering()).rejects.toMatchObject({ code: 'NO_STORE_PLANS' });
  const current = { availablePackages: [{ product: { identifier: 'pro_monthly' } }] };
  Purchases.getOfferings.mockResolvedValueOnce({ current });
  await expect(fetchOffering()).resolves.toBe(current);
  warning.mockRestore();
});

it('never promises an introductory offer for ineligible or unknown customers', async () => {
  const packages = ['eligible', 'ineligible', 'unknown'].map(identifier => ({ product: { identifier } }));
  Purchases.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ eligible: { status: 2 }, ineligible: { status: 1 }, unknown: { status: 0 } });
  await expect(fetchTrialEligibility(packages)).resolves.toEqual({ eligible: true, ineligible: false, unknown: false });
  Purchases.checkTrialOrIntroductoryPriceEligibility.mockRejectedValue(new Error('Offline'));
  await expect(fetchTrialEligibility(packages)).resolves.toEqual({});
});

// ── Per-platform SDK keys ──────────────────────────────────────────────────
// Each store has its own public key (appl_… / goog_…), and lib/purchases keeps
// module state (configured, cached SDK), so each scenario loads a fresh copy of
// the module with its own platform and app-config extra.
function loadPurchases({ os, extra }) {
  jest.resetModules();
  jest.doMock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra } } }));
  require('react-native').Platform.OS = os;
  const PurchasesMock = require('react-native-purchases').default;
  const purchases = require('../lib/purchases');
  return { purchases, PurchasesMock };
}

const BOTH_KEYS = { revenueCatIosKey: 'appl_test', revenueCatAndroidKey: 'goog_test' };

it('configures with the Android store key on Android', async () => {
  const { purchases, PurchasesMock } = loadPurchases({ os: 'android', extra: BOTH_KEYS });
  expect(purchases.purchasesAvailable()).toBe(true);
  await expect(purchases.configurePurchases()).resolves.toBe(true);
  expect(PurchasesMock.configure).toHaveBeenCalledWith({ apiKey: 'goog_test' });
});

it('configures with the iOS store key on iOS', async () => {
  const { purchases, PurchasesMock } = loadPurchases({ os: 'ios', extra: BOTH_KEYS });
  expect(purchases.purchasesAvailable()).toBe(true);
  await expect(purchases.configurePurchases()).resolves.toBe(true);
  expect(PurchasesMock.configure).toHaveBeenCalledWith({ apiKey: 'appl_test' });
});

it('reads Android trial eligibility off the offer Play already filtered, not the iOS API', async () => {
  // checkTrialOrIntroductoryPriceEligibility always answers UNKNOWN on Android;
  // trusting it there would hide the annual trial from every Android customer.
  const { purchases, PurchasesMock } = loadPurchases({ os: 'android', extra: BOTH_KEYS });
  await purchases.configurePurchases();
  PurchasesMock.checkTrialOrIntroductoryPriceEligibility.mockResolvedValue({ pro_annual: { status: 0 } });
  const packages = [
    { product: { identifier: 'pro_annual', introPrice: { price: 0, periodNumberOfUnits: 3, periodUnit: 'DAY' } } },
    { product: { identifier: 'pro_monthly', introPrice: null } },
  ];
  await expect(purchases.fetchTrialEligibility(packages)).resolves.toEqual({ pro_annual: true, pro_monthly: false });
  expect(PurchasesMock.checkTrialOrIntroductoryPriceEligibility).not.toHaveBeenCalled();
});

it('runs without Pro rather than crashing when the Android key is missing', async () => {
  // Only the iOS key is set: Android must NOT borrow it — it must degrade.
  const { purchases, PurchasesMock } = loadPurchases({
    os: 'android',
    extra: { revenueCatIosKey: 'appl_test' },
  });
  expect(purchases.purchasesAvailable()).toBe(false);
  await expect(purchases.configurePurchases()).resolves.toBe(false);
  expect(PurchasesMock.configure).not.toHaveBeenCalled();
  await expect(purchases.fetchOffering()).rejects.toMatchObject({ code: 'PLANS_NOT_CONFIGURED' });
  await expect(purchases.fetchProStatus()).resolves.toEqual({ isPro: false, expiresAt: null, willRenew: false });
});
