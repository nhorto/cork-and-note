import { act, create } from 'react-test-renderer';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import AutocompleteVarietal from '../components/AutocompleteVarietal';

test('suggestions expand in flow and remain tappable inside a keyboard-aware form scroll', async () => {
  const onSelect = jest.fn();
  let tree;
  await act(async () => {
    tree = create(
      <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
        <AutocompleteVarietal value="Cab" onChangeText={jest.fn()} onSelect={onSelect} />
      </ScrollView>
    );
  });

  await act(async () => tree.root.findByType(TextInput).props.onFocus());
  const cabernet = tree.root.findByProps({ accessibilityLabel: 'Select Cabernet Sauvignon' });
  const suggestionPanel = cabernet.parent.parent.parent;
  const panelStyle = StyleSheet.flatten(suggestionPanel.props.style);

  // Absolute positioning caused the panel to render over (and under) the next
  // form fields on Android. An in-flow panel has no position/top/z-index hacks.
  expect(panelStyle.position).not.toBe('absolute');
  expect(panelStyle.top).toBeUndefined();
  expect(panelStyle.zIndex).toBeUndefined();
  expect(tree.root.findByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');

  await act(async () => cabernet.props.onPress());
  expect(onSelect).toHaveBeenCalledWith('Cabernet Sauvignon');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Select Cabernet Sauvignon' })).toHaveLength(0);
  await act(async () => tree.unmount());
});
