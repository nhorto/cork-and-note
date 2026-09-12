// The Achievements screen and the Profile card (#296), over a fixed journey.
//
// The screen's job is to tell you where you stand and what is left: so the
// tests assert the level line, a family's progress sentence, a locked badge
// showing its rule (the invitation), and that opening the collection clears the
// unseen flag.
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('expo-router', () => {
  const router = { push: jest.fn(), back: jest.fn() };
  return { __router: router, useRouter: () => router };
});
jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return { useFocusEffect: (callback) => React.useEffect(callback, [callback]) };
});
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../lib/achievements', () => ({
  getAchievements: jest.fn(),
  getUnseen: jest.fn(async () => ({ success: true, rows: [] })),
  markSeen: jest.fn(async () => ({ success: true, count: 0 })),
}));

const { __router: mockRouter } = require('expo-router');
const { getAchievements, getUnseen, markSeen } = require('../lib/achievements');
const AchievementsScreen = require('../app/profile/achievements').default;
const AchievementsCard = require('../components/AchievementsCard').default;

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const result = () => ({
  points: 110,
  level: { level: 2, title: 'Half Bottle', points: 50, next: { level: 3, title: 'Bottle', points: 150 } },
  families: [
    {
      key: 'winery_explorer', name: 'Winery Explorer', icon: 'map-marker-path', unit: 'wineries',
      rule: 'Distinct wineries with a logged visit.', count: 7, thresholds: [1, 5, 15, 40],
      tier: 'silver', tierLabel: 'Silver', tierIndex: 1, nextTier: 'gold', nextThreshold: 15, progress: 0.2,
    },
    {
      key: 'region_explorer', name: 'Region Explorer', icon: 'map-outline', unit: 'regions',
      rule: 'Wine regions with a visited winery. US AVAs for now.', count: 0, thresholds: [1, 3, 6, 12],
      tier: null, tierLabel: null, tierIndex: -1, nextTier: 'bronze', nextThreshold: 1, progress: 0,
    },
  ],
  grapes: [],
  allGrapes: [
    { key: 'grape:Chardonnay', grape: 'Chardonnay', count: 12, tier: 'lover', tierLabel: 'Lover', nextThreshold: 25, progress: 0.1 },
    { key: 'grape:Merlot', grape: 'Merlot', count: 1, tier: null, tierLabel: null, nextThreshold: 3, progress: 0.3 },
  ],
  oneOffs: [
    { key: 'cork_popped', shelf: 'cellar', name: 'Cork Popped', icon: 'bottle-wine', rule: 'First bottle opened from your cellar.', points: 15, earned: true },
    { key: 'day_tripper', shelf: 'places', name: 'Day Tripper', icon: 'car-outline', rule: '3 wineries in one day.', points: 15, earned: false },
  ],
  newlyEarned: [],
});

const earnedRows = [
  { id: 'r1', badge_key: 'winery_explorer', tier: 'silver', points: 25, earned_at: '2026-09-10T12:00:00Z', source: 'live' },
  { id: 'r2', badge_key: 'grape:Chardonnay', tier: 'lover', points: 25, earned_at: '2026-08-01T12:00:00Z', source: 'backfill' },
];

const mount = async (Component) => {
  let tree;
  await act(async () => {
    tree = create(<Component />);
  });
  await flush();
  return tree;
};

beforeEach(() => {
  jest.clearAllMocks();
  getAchievements.mockResolvedValue({ success: true, result: result(), earnedRows });
  getUnseen.mockResolvedValue({ success: true, rows: [] });
});

describe('the Achievements screen', () => {
  test('leads with where you stand and how far to the next level', async () => {
    const tree = await mount(AchievementsScreen);
    const t = texts(tree);
    expect(t).toContain('Level 2 · Half Bottle');
    expect(t).toContain('110 pts');
    expect(t).toContain('40 to Bottle');
  });

  test('says "Top level" rather than counting to nothing', async () => {
    const maxed = result();
    maxed.level = { level: 9, title: 'Nebuchadnezzar', points: 2300, next: null };
    getAchievements.mockResolvedValue({ success: true, result: maxed, earnedRows });
    const tree = await mount(AchievementsScreen);
    expect(texts(tree)).toContain('Top level');
  });

  test('a family shows its tier, its progress sentence and its rule', async () => {
    const t = texts(await mount(AchievementsScreen));
    expect(t).toContain('Winery Explorer · Silver');
    expect(t).toContain('7 of 15 toward Gold');
    expect(t).toContain('Distinct wineries with a logged visit.');
  });

  test('a locked one-off shows the rule, an earned one shows its points', async () => {
    const t = texts(await mount(AchievementsScreen));
    expect(t).toContain('3 wineries in one day.');
    expect(t).toContain('Earned · 15 pts');
  });

  test('the grape shelf counts what is earned and what is left', async () => {
    const t = texts(await mount(AchievementsScreen));
    expect(t).toContain('1 of 2 at Fan or better');
    expect(t).toContain('Lover');      // Chardonnay
    expect(t).toContain('1 of 3');     // Merlot, still locked
  });

  test('history separates the backfill from what was earned live', async () => {
    const t = texts(await mount(AchievementsScreen));
    expect(t).toContain('Winery Explorer · Silver');
    expect(t).toContain('Recognized from your journal');
    expect(t).toContain('Chardonnay · Lover');
  });

  test('opening the collection marks the unseen badges seen', async () => {
    getUnseen.mockResolvedValue({ success: true, rows: [{ id: 'r1' }] });
    await mount(AchievementsScreen);
    expect(markSeen).toHaveBeenCalledWith([{ id: 'r1' }]);
  });

  test('a failed load says so instead of showing an empty collection', async () => {
    getAchievements.mockResolvedValue({ success: false, error: 'offline' });
    const t = texts(await mount(AchievementsScreen));
    expect(t.some((x) => x.includes('could not load your badges'))).toBe(true);
    expect(t).not.toContain('FAMILIES');
  });

  test('a new account is invited to start rather than shown a wall of zeros', async () => {
    getAchievements.mockResolvedValue({ success: true, result: result(), earnedRows: [] });
    const t = texts(await mount(AchievementsScreen));
    expect(t).toContain('Log your first wine to earn your first badge.');
  });
});

describe('the Profile card', () => {
  test('shows the level, the totals and a badge per recent award', async () => {
    const t = texts(await mount(AchievementsCard));
    expect(t).toContain('Level 2 · Half Bottle');
    // 2 families x 4 tiers + 2 grapes x 3 tiers + 2 one-offs = 16
    expect(t).toContain('110 pts · 2 of 16 badges');
  });

  test('taps through to the collection', async () => {
    const tree = await mount(AchievementsCard);
    const card = tree.root
      .findAll((n) => n.props.accessibilityLabel === 'Open your achievements')
      .find((n) => typeof n.props.onPress === 'function');
    act(() => card.props.onPress());
    expect(mockRouter.push).toHaveBeenCalledWith('/profile/achievements');
  });

  test('hides itself entirely when achievements cannot load', async () => {
    getAchievements.mockResolvedValue({ success: false });
    const tree = await mount(AchievementsCard);
    expect(tree.toJSON()).toBeNull();
  });

  test('a user with no badges yet is invited, not shown an empty row', async () => {
    getAchievements.mockResolvedValue({ success: true, result: result(), earnedRows: [] });
    expect(texts(await mount(AchievementsCard))).toContain('Log a wine to earn your first badge.');
  });
});
