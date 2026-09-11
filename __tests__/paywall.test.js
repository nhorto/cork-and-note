// Behaviour tests for the Pro paywall (app/paywall.js): the loading state, the
// three distinct load-error codes each with their own message and a working
// retry, a successful purchase closing the screen through onPurchased, a user
// cancel NOT being treated as an error, the restore path, and the trial label
// only appearing when the store confirms eligibility.
import { act, create } from 'react-test-renderer';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { usePro } from '../hooks/usePro';
import { fetchOffering, fetchTrialEligibility, purchasePackage } from '../lib/purchases';
import PaywallScreen from '../app/paywall';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
const mockBack = jest.fn();
let mockParams = {};
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: jest.fn(), setParams: jest.fn() }),
  useLocalSearchParams: () => mockParams,
}));
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../lib/purchases', () => ({
  fetchOffering: jest.fn(),
  fetchTrialEligibility: jest.fn(),
  purchasePackage: jest.fn(),
}));

const pkg = (identifier, { period = 'P1M', trial = null } = {}) => ({
  identifier,
  packageType: period === 'P1Y' ? 'ANNUAL' : 'MONTHLY',
  product: {
    identifier: `prod_${identifier}`,
    priceString: identifier === 'annual' ? '$59.99' : '$9.99',
    subscriptionPeriod: period,
    introPrice: trial,
  },
});

const monthly = pkg('monthly');
const annual = pkg('annual', { period: 'P1Y', trial: { price: 0, periodNumberOfUnits: 3, periodUnit: 'day' } });

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const hasText = (tree, needle) => texts(tree).some((t) => t.includes(needle));
const pressText = async (tree, label) => {
  const btn = tree.root
    .findAllByType(TouchableOpacity)
    .find((n) => n.findAllByType(Text).some((t) => String(t.props.children).includes(label)));
  if (!btn) throw new Error(`No button labelled ${label}`);
  await act(async () => btn.props.onPress());
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

const baseUsePro = (overrides = {}) => ({
  isPro: false,
  purchasesAvailable: true,
  restore: jest.fn(),
  onPurchased: jest.fn(),
  ...overrides,
});

const render = async () => {
  let tree;
  await act(async () => {
    tree = create(<PaywallScreen />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return tree;
};

beforeEach(() => {
  mockParams = {};
  jest.clearAllMocks();
});

describe('loading and load errors', () => {
  it('shows a loading state before the offering resolves', async () => {
    let resolveOffering;
    fetchOffering.mockReturnValue(new Promise((resolve) => { resolveOffering = resolve; }));
    fetchTrialEligibility.mockResolvedValue({});
    usePro.mockReturnValue(baseUsePro());
    let tree;
    await act(async () => {
      tree = create(<PaywallScreen />);
    });
    expect(hasText(tree, 'Loading plans')).toBe(true);
    await act(async () => {
      resolveOffering({ availablePackages: [monthly] });
      await new Promise((r) => setTimeout(r, 0));
    });
  });

  it.each([
    ['PLANS_NOT_CONFIGURED', 'Plans are not configured in this build. Please contact support.'],
    ['NO_STORE_PLANS', 'Plans could not be loaded. Please try again shortly.'],
    ['STORE_PLANS_ERROR', 'Plans could not be loaded. Check your connection and try again.'],
  ])('%s shows its own message and a working retry', async (code, message) => {
    const error = new Error(message);
    error.code = code;
    fetchOffering.mockRejectedValueOnce(error);
    usePro.mockReturnValue(baseUsePro());
    const tree = await render();
    expect(hasText(tree, message)).toBe(true);
    expect(hasText(tree, code)).toBe(true);

    fetchOffering.mockResolvedValueOnce({ availablePackages: [monthly] });
    fetchTrialEligibility.mockResolvedValueOnce({});
    await pressText(tree, 'Try again');
    expect(fetchOffering).toHaveBeenCalledTimes(2);
    expect(hasText(tree, message)).toBe(false);
  });
});

describe('purchase flow', () => {
  it('a successful purchase calls onPurchased and closes the screen', async () => {
    fetchOffering.mockResolvedValue({ availablePackages: [monthly] });
    fetchTrialEligibility.mockResolvedValue({});
    const onPurchased = jest.fn();
    purchasePackage.mockResolvedValue({ isPro: true, cancelled: false, error: null });
    usePro.mockReturnValue(baseUsePro({ onPurchased }));
    const tree = await render();
    await pressText(tree, 'Continue');
    expect(purchasePackage).toHaveBeenCalledWith(monthly);
    expect(onPurchased).toHaveBeenCalledTimes(1);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('a user cancel is not an error: no alert, screen stays open', async () => {
    fetchOffering.mockResolvedValue({ availablePackages: [monthly] });
    fetchTrialEligibility.mockResolvedValue({});
    const onPurchased = jest.fn();
    purchasePackage.mockResolvedValue({ isPro: false, cancelled: true, error: null });
    usePro.mockReturnValue(baseUsePro({ onPurchased }));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tree = await render();
    await pressText(tree, 'Continue');
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onPurchased).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('a purchase failure alerts the store error and does not close', async () => {
    fetchOffering.mockResolvedValue({ availablePackages: [monthly] });
    fetchTrialEligibility.mockResolvedValue({});
    purchasePackage.mockResolvedValue({ isPro: false, cancelled: false, error: 'Card declined' });
    usePro.mockReturnValue(baseUsePro());
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tree = await render();
    await pressText(tree, 'Continue');
    expect(alertSpy).toHaveBeenCalledWith('Purchase failed', 'Card declined');
    expect(mockBack).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('restore flow', () => {
  it('a successful restore alerts welcome back and closes', async () => {
    fetchOffering.mockResolvedValue({ availablePackages: [monthly] });
    fetchTrialEligibility.mockResolvedValue({});
    const restore = jest.fn().mockResolvedValue({ isPro: true, error: null });
    usePro.mockReturnValue(baseUsePro({ restore }));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tree = await render();
    await pressText(tree, 'Restore Purchases');
    expect(restore).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('Welcome back', expect.stringContaining('restored'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });

  it('a restore with nothing found alerts and stays on the paywall', async () => {
    fetchOffering.mockResolvedValue({ availablePackages: [monthly] });
    fetchTrialEligibility.mockResolvedValue({});
    const restore = jest.fn().mockResolvedValue({ isPro: false, error: 'No purchase history found.' });
    usePro.mockReturnValue(baseUsePro({ restore }));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const tree = await render();
    await pressText(tree, 'Restore Purchases');
    expect(alertSpy).toHaveBeenCalledWith('Nothing to restore', 'No purchase history found.');
    expect(mockBack).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });
});

describe('trial labelling', () => {
  it('shows the trial label only for a package the store marked eligible', async () => {
    fetchOffering.mockResolvedValue({ availablePackages: [annual, monthly] });
    fetchTrialEligibility.mockResolvedValue({ [annual.product.identifier]: true, [monthly.product.identifier]: false });
    usePro.mockReturnValue(baseUsePro());
    const tree = await render();
    // Annual sorts first and is selected by default: trial copy is visible.
    expect(hasText(tree, '3-day free trial')).toBe(true);
    expect(hasText(tree, 'Start free trial')).toBe(true);
  });

  it('never shows a trial for a customer the store marked ineligible', async () => {
    fetchOffering.mockResolvedValue({ availablePackages: [annual, monthly] });
    fetchTrialEligibility.mockResolvedValue({ [annual.product.identifier]: false, [monthly.product.identifier]: false });
    usePro.mockReturnValue(baseUsePro());
    const tree = await render();
    // The legal boilerplate mentions trials in general; what must not appear
    // is the per-plan trial label or the trial call to action.
    expect(hasText(tree, '3-day free trial')).toBe(false);
    expect(hasText(tree, 'Start free trial')).toBe(false);
    expect(hasText(tree, 'Continue')).toBe(true);
  });
});
