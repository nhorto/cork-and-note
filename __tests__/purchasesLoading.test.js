import Purchases from 'react-native-purchases';
import { fetchOffering, fetchTrialEligibility } from '../lib/purchases';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: { revenueCatIosKey: 'appl_test' } } } }));
jest.mock('react-native-purchases', () => ({ __esModule: true, default: {
  configure: jest.fn(),
  getOfferings: jest.fn(),
  checkTrialOrIntroductoryPriceEligibility: jest.fn(),
} }));

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
