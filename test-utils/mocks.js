// test-utils/mocks.js: factories for the module mocks screen tests keep re-declaring.
//
// jest.mock() hoists its factory above imports, so a factory cannot close over
// test-file variables unless their names start with `mock`. Use these through
// `require` inside the factory:
//
//   const mockRouter = require('../test-utils/mocks').routerMock();
//   jest.mock('expo-router', () => require('../test-utils/mocks').expoRouterModule(mockRouter));
//
// Then assert on `mockRouter.push` etc.

/** A router whose every method is a jest.fn. */
export function routerMock() {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
  };
}

/**
 * The expo-router module surface screens use. `params` is what
 * useLocalSearchParams returns; `useFocusEffect` runs like a mount effect so a
 * focus-loaded screen loads once per render tree.
 */
export function expoRouterModule(router = routerMock(), params = {}) {
  const React = require('react');
  return {
    useRouter: () => router,
    router,
    useLocalSearchParams: () => params,
    useGlobalSearchParams: () => params,
    useFocusEffect: (callback) => React.useEffect(callback, []),
    useNavigation: () => ({ setOptions: jest.fn(), goBack: router.back, addListener: jest.fn(() => () => {}) }),
    usePathname: () => '/',
    useSegments: () => [],
    Link: ({ children }) => children ?? null,
    Redirect: () => null,
    Stack: Object.assign(({ children }) => children ?? null, { Screen: () => null }),
    Tabs: Object.assign(({ children }) => children ?? null, { Screen: () => null }),
  };
}

/** react-native-maps as string element types, so findAllByType('Marker') works. */
export function mapsModule() {
  return { __esModule: true, default: 'MapView', Marker: 'Marker', Polygon: 'Polygon', Polyline: 'Polyline', Callout: 'Callout' };
}

/** A usePro() value. Pass overrides for the one thing a test cares about. */
export function proValue(overrides = {}) {
  return {
    isPro: false,
    loading: false,
    usage: {},
    remaining: () => 0,
    gate: jest.fn(() => true),
    presentPaywall: jest.fn(),
    refresh: jest.fn(),
    onPurchased: jest.fn(),
    restore: jest.fn(),
    ...overrides,
  };
}
