// Smoke test for the "My taste" screen: the three states a journal can put it
// in, and that a thin journal never meets a paywall.
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { usePro } from '../hooks/usePro';
import { tasteReportService } from '../lib/tasteProfile';
import { visitsService } from '../lib/visits';
import TasteScreen from '../app/sommelier/taste';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), setParams: jest.fn() }),
  useFocusEffect: (callback) => require('react').useEffect(callback, []),
}));
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../lib/visits', () => ({ visitsService: { getUserVisits: jest.fn() } }));
jest.mock('../lib/ai', () => ({ aiService: { sendMessage: jest.fn(), parseFencedJson: jest.fn() } }));
jest.mock('../lib/supabase', () => ({ supabase: { auth: {}, from: jest.fn(), functions: {} } }));
jest.mock('../lib/tasteProfile', () => ({
  ...jest.requireActual('../lib/tasteProfile'),
  tasteReportService: { loadLatest: jest.fn(), generate: jest.fn(), remove: jest.fn() },
}));

const journal = (n) => [
  {
    id: 'v1',
    visit_date: '2026-09-01',
    wineries: { name: 'Estate' },
    wines: Array.from({ length: n }, (_, i) => ({
      id: `w${i}`,
      wine_name: `Wine ${i}`,
      winemaker: 'Maker',
      wine_year: 2020,
      wine_type: i % 2 ? 'White' : 'Red',
      wine_varietal: ['Cabernet Franc'],
      overall_rating: 4,
      sweetness: 0,
      tannin: 3,
      acidity: 0,
      body: 0,
      alcohol: 0,
      wine_flavor_notes: [],
    })),
  },
];

const texts = (tree) => tree.root.findAllByType(Text).map((t) => String(t.props.children));
const hasText = (tree, needle) => texts(tree).some((t) => t.includes(needle));

const render = async () => {
  let tree;
  await act(async () => {
    tree = create(<TasteScreen />);
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
  return tree;
};

describe('My taste screen', () => {
  const presentPaywall = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    tasteReportService.loadLatest.mockResolvedValue({ success: true, report: null });
  });

  it('shows progress for two rated wines with no paywall, for a free user', async () => {
    usePro.mockReturnValue({ isPro: false, isLoading: false, presentPaywall });
    visitsService.getUserVisits.mockResolvedValue({ success: true, visits: journal(2) });
    const tree = await render();

    expect(hasText(tree, 'A little more tasting to go')).toBe(true);
    expect(tree.root.findByProps({ testID: 'taste-progress-count' }).props.children).toBe(
      '2 of 5 distinct wines rated'
    );
    expect(hasText(tree, 'Unlock')).toBe(false);
    expect(presentPaywall).not.toHaveBeenCalled();

    act(() => tree.root.findByProps({ accessibilityLabel: 'Log a tasting' }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/log');
  });

  it('shows the free preview with real numbers and a sample at six wines', async () => {
    usePro.mockReturnValue({ isPro: false, isLoading: false, presentPaywall });
    visitsService.getUserVisits.mockResolvedValue({ success: true, visits: journal(6) });
    const tree = await render();

    expect(hasText(tree, 'Your numbers are real')).toBe(true);
    expect(hasText(tree, 'SAMPLE')).toBe(true);
    expect(hasText(tree, 'Cabernet Franc')).toBe(true);
    const cta = tree.root.findByProps({ accessibilityLabel: 'Unlock my report with Pro. Opens Cork and Note Pro.' });
    act(() => cta.props.onPress());
    expect(presentPaywall).toHaveBeenCalledWith('taste_report');
    expect(tasteReportService.generate).not.toHaveBeenCalled();
  });

  it('renders a saved report for Pro and flags new tastings', async () => {
    usePro.mockReturnValue({ isPro: true, isLoading: false, presentPaywall });
    visitsService.getUserVisits.mockResolvedValue({ success: true, visits: journal(6) });
    tasteReportService.loadLatest.mockResolvedValue({
      success: true,
      report: {
        id: 'r1',
        tier: 'first_impressions',
        wine_count: 5,
        created_at: '2026-09-10T10:00:00Z',
        source_revision: 'stale',
        evidence_ids: ['w0', 'w1'],
        report: {
          headline: 'You lean toward reds with grip.',
          observations: [{ title: 'Grip', body: 'Body.', evidence_wine_ids: ['w0', 'gone'] }],
          try_next: [{ title: 'Mencía', body: 'Why.' }],
          caveat: 'Early days.',
        },
      },
    });
    const tree = await render();

    expect(tree.root.findByProps({ testID: 'taste-headline' }).props.children).toBe(
      'You lean toward reds with grip.'
    );
    expect(hasText(tree, 'New tastings since this report')).toBe(true);
    expect(hasText(tree, 'SAMPLE')).toBe(false);

    act(() => tree.root.findByProps({ accessibilityLabel: 'See the supporting tastings' }).props.onPress());
    act(() => tree.root.findByProps({ accessibilityLabel: 'Open Wine 0' }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/wine/w0');

    act(() => tree.root.findByProps({ accessibilityLabel: 'Ask about my taste' }).props.onPress());
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/sommelier',
      params: { ask: 'Based on my taste report, what should I try next?' },
    });
  });

  it('opens the paywall when the server refuses the refresh', async () => {
    usePro.mockReturnValue({ isPro: true, isLoading: false, presentPaywall });
    visitsService.getUserVisits.mockResolvedValue({ success: true, visits: journal(6) });
    tasteReportService.generate.mockResolvedValue({ success: false, error: 'Pro', code: 'free_limit_reached' });
    const tree = await render();

    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Create my report' }).props.onPress();
    });
    expect(tasteReportService.generate).toHaveBeenCalled();
    expect(presentPaywall).toHaveBeenCalledWith('taste_report');
  });
});
