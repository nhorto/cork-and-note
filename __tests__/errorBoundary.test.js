// The error boundary around the navigator: a render throw shows a fallback
// with a working retry instead of a blank screen, and the root layout
// actually mounts it around the Stack.
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import ErrorBoundary from '../components/ErrorBoundary';

const texts = (tree) => tree.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

function Screen({ shouldThrow }) {
  if (shouldThrow) throw new Error('null join in a list row');
  return <Text>Cellar loaded</Text>;
}

beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => console.error.mockRestore());

test('renders its children when nothing throws', async () => {
  let tree;
  await act(async () => { tree = create(<ErrorBoundary><Screen /></ErrorBoundary>); });
  expect(texts(tree)).toContain('Cellar loaded');
  expect(texts(tree)).not.toContain('Something went wrong');
});

test('a render throw shows the fallback, reports the error, and retry remounts the child', async () => {
  const onError = jest.fn();
  let shouldThrow = true;
  const Flaky = () => <Screen shouldThrow={shouldThrow} />;
  let tree;
  await act(async () => { tree = create(<ErrorBoundary onError={onError}><Flaky /></ErrorBoundary>); });

  expect(texts(tree)).toContain('Something went wrong');
  expect(texts(tree)).not.toContain('Cellar loaded');
  expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'null join in a list row' }), expect.anything());
  expect(tree.root.findByProps({ accessibilityRole: 'alert' })).toBeTruthy();

  // The cause goes away (a refetch, a navigation) and the user taps retry.
  shouldThrow = false;
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Try again' }).props.onPress());
  expect(texts(tree)).toContain('Cellar loaded');
  expect(texts(tree)).not.toContain('Something went wrong');
});

test('a retry that throws again lands back on the fallback rather than crashing', async () => {
  let tree;
  await act(async () => { tree = create(<ErrorBoundary><Screen shouldThrow /></ErrorBoundary>); });
  await act(async () => tree.root.findByProps({ accessibilityLabel: 'Try again' }).props.onPress());
  expect(texts(tree)).toContain('Something went wrong');
});

test('the root layout wraps the navigator in the boundary, inside the providers', () => {
  // A structural check: the boundary must sit below the auth, Pro and theme
  // providers (so retry keeps them) and above the Stack (so it catches every
  // screen). Rendering the real root layout needs the whole app; the source
  // is the cheapest reliable witness.
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'app', '_layout.js'), 'utf8');
  const at = (needle) => { const i = src.indexOf(needle); expect(i).toBeGreaterThan(-1); return i; };
  const boundaryOpen = at('<ErrorBoundary>');
  expect(boundaryOpen).toBeGreaterThan(at('<ProProvider'));
  expect(boundaryOpen).toBeGreaterThan(at('<ThemeProvider'));
  expect(boundaryOpen).toBeLessThan(at('<Stack '));
  expect(at('</ErrorBoundary>')).toBeGreaterThan(at('</Stack>'));
});
