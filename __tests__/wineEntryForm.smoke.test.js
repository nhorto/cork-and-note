// Render smoke test for the restructured log-a-wine form (#216): the form must
// mount with the quick path (verdict stars + notes) visible, all three
// optional sections present as collapsed headers, and the sticky save bar.
//
// The scanner and sommelier chat pull in supabase (and through it, native
// AsyncStorage), which has no jest mock in this repo — they're stubbed out
// here because this test is about the form's own structure, not theirs.
jest.mock('../components/LabelScanner', () => () => null);
jest.mock('../components/WineChatModal', () => () => null);
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { act, create } from 'react-test-renderer';
import WineEntryForm from '../components/WineEntryForm';

test('WineEntryForm mounts with verdict, collapsibles, and save bar', async () => {
  let tree;
  await act(async () => {
    tree = create(<WineEntryForm onSave={() => {}} onCancel={() => {}} />);
  });
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('Your verdict');
  expect(json).toContain('Detailed ratings');
  expect(json).toContain('Flavor notes');
  expect(json).toContain('Photos');
  expect(json).toContain('Save wine');
  await act(async () => tree.unmount());
});
