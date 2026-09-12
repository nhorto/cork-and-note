// The badge, the sheet and the collection screen (#296).
//
// Colour carries the tier, so the thing worth testing is that colour is never
// the ONLY carrier: a locked badge is dimmed and dashed, and a tier that is
// named is named in text.
import { act, create } from 'react-test-renderer';
import { Text, View } from 'react-native';
import AchievementBadge from '../components/AchievementBadge';
import AchievementSheet from '../components/AchievementSheet';

jest.mock('../lib/haptics', () => ({ tapMedium: jest.fn() }));
const { tapMedium } = require('../lib/haptics');

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const flatten = (style) => Object.assign({}, ...[].concat(style).filter(Boolean));
const circleOf = (tree) =>
  flatten(tree.root.findAllByType(View).find((n) => flatten(n.props.style).borderWidth === 3)?.props.style);

const render = (element) => {
  let tree;
  act(() => {
    tree = create(element);
  });
  return tree;
};

describe('AchievementBadge', () => {
  test('an earned badge is solid and fully opaque', () => {
    const tree = render(<AchievementBadge icon="glass-wine" tier="gold" />);
    const circle = circleOf(tree);
    expect(circle.borderStyle).toBe('solid');
    expect(circle.opacity).toBe(1);
  });

  test('a locked badge is dashed and dimmed, not just a different colour', () => {
    const tree = render(<AchievementBadge icon="glass-wine" tier={null} locked />);
    const circle = circleOf(tree);
    expect(circle.borderStyle).toBe('dashed');
    expect(circle.opacity).toBeLessThan(0.5);
  });

  test('every tier renders and each gets its own ring colour', () => {
    const colors = ['bronze', 'silver', 'gold', 'platinum', 'fan', 'lover', 'devotee', 'earned'].map(
      (tier) => circleOf(render(<AchievementBadge tier={tier} />)).borderColor
    );
    expect(colors.every(Boolean)).toBe(true);
    // Bronze, silver, gold and platinum must be four distinct colours.
    expect(new Set(colors.slice(0, 4)).size).toBe(4);
  });

  test('the label is rendered as text when passed', () => {
    const tree = render(<AchievementBadge tier="gold" label="Chardonnay" />);
    expect(texts(tree)).toContain('Chardonnay');
  });

  test('size drives the circle', () => {
    const circle = circleOf(render(<AchievementBadge tier="gold" size={80} />));
    expect(circle.width).toBe(80);
    expect(circle.borderRadius).toBe(40);
  });
});

describe('AchievementSheet', () => {
  const awards = [
    { badge_key: 'winery_explorer', tier: 'bronze', points: 10, label: 'Winery Explorer, Bronze', icon: 'map-marker-path' },
    { badge_key: 'journal_keeper', tier: 'bronze', points: 10, label: 'Journal Keeper, Bronze', icon: 'notebook-outline' },
  ];
  const level = { level: 2, title: 'Half Bottle', points: 50, next: null };

  test('lists every award with its points and pluralizes the title', () => {
    const tree = render(<AchievementSheet visible awards={awards} level={level} />);
    const t = texts(tree);
    expect(t).toContain('New badges');
    expect(t).toContain('Winery Explorer, Bronze');
    expect(t).toContain('Journal Keeper, Bronze');
    expect(t.filter((x) => x === '+10 pts')).toHaveLength(2);
  });

  test('one award reads in the singular', () => {
    const tree = render(<AchievementSheet visible awards={[awards[0]]} level={level} />);
    expect(texts(tree)).toContain('New badge');
  });

  test('a level up is announced, and otherwise the level is just stated', () => {
    const up = render(
      <AchievementSheet visible awards={awards} level={level} levelUp={{ level: 1, title: 'Split' }} />
    );
    expect(texts(up)).toContain('Level up: Level 2 · Half Bottle');

    const flat = render(<AchievementSheet visible awards={awards} level={level} />);
    expect(texts(flat)).toContain('Level 2 · Half Bottle');
    expect(texts(flat).some((x) => x.startsWith('Level up'))).toBe(false);
  });

  test('a backfill says where the badges came from', () => {
    const tree = render(<AchievementSheet visible awards={awards} level={level} backfill />);
    expect(texts(tree)).toContain('Your journal has been recognized');
  });

  test('the buttons call their handlers', () => {
    const onClose = jest.fn();
    const onViewCollection = jest.fn();
    const tree = render(
      <AchievementSheet visible awards={awards} level={level} onClose={onClose} onViewCollection={onViewCollection} />
    );
    const press = (label) => {
      const node = tree.root
        .findAll((n) => n.props.onPress && n.findAllByType(Text).some((t) => [].concat(t.props.children).join('') === label))
        .at(-1);
      act(() => node.props.onPress());
    };
    press('Done');
    press('See collection');
    expect(onClose).toHaveBeenCalled();
    expect(onViewCollection).toHaveBeenCalled();
  });

  test('showing the sheet taps the user on the wrist', () => {
    tapMedium.mockClear();
    render(<AchievementSheet visible awards={awards} level={level} />);
    expect(tapMedium).toHaveBeenCalled();
  });

  test('an empty award list does not buzz', () => {
    tapMedium.mockClear();
    render(<AchievementSheet visible awards={[]} level={level} />);
    expect(tapMedium).not.toHaveBeenCalled();
  });
});
