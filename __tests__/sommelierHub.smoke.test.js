// Smoke test for the Sommelier tab's hub (2026-09-11): the ask box is the
// hero, the three guided tools are present and route to their screens, and a
// question typed into the box starts a chat and sends it.
import { act, create } from 'react-test-renderer';

import { usePro } from '../hooks/usePro';
import { chatService } from '../lib/chat';
import { aiService } from '../lib/ai';
import SommelierScreen from '../app/(tabs)/sommelier';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, setParams: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../components/TonightsPickCard', () => () => null);
jest.mock('../components/ChatBubble', () => () => null);
jest.mock('../components/ChatInput', () => () => null);
jest.mock('../components/TypingDots', () => () => null);
jest.mock('../components/MeterHint', () => () => null);
jest.mock('../components/ProUpsellCard', () => () => null);
jest.mock('../components/UpgradePill', () => () => null);
jest.mock('../lib/ai', () => ({
  aiService: {
    buildSystemPrompt: jest.fn().mockResolvedValue('system'),
    sendMessage: jest.fn().mockResolvedValue({ response: 'Try a Cab Franc.', sources: [] }),
    parseSuggestions: jest.fn().mockReturnValue([]),
    getDisplayText: (t) => t,
    photoToBase64: jest.fn(),
  },
}));
jest.mock('../lib/chat', () => ({
  chatService: {
    getConversations: jest.fn().mockResolvedValue([]),
    createConversation: jest.fn().mockResolvedValue({ id: 'conv-1', title: 'New' }),
    getMessages: jest.fn().mockResolvedValue([]),
    addMessage: jest.fn().mockResolvedValue({ id: 'm1' }),
    generateTitle: (t) => t.slice(0, 20),
    updateConversationTitle: jest.fn().mockResolvedValue(undefined),
    uploadChatPhoto: jest.fn(),
    deleteConversation: jest.fn(),
  },
}));

// Drain the promise chains behind loadConversations / startNewChat / handleSend.
const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

// The tile's host node — the one that actually carries the accessibility label.
const tile = (tree, testID) =>
  tree.root.findAllByProps({ testID }).find((n) => n.props.accessibilityLabel !== undefined);

describe('Sommelier hub', () => {
  beforeEach(() => {
    mockPush.mockClear();
    usePro.mockReturnValue({
      gate: () => true,
      isPro: false,
      isLoading: false,
      remaining: () => 5,
      presentPaywall: jest.fn(),
    });
  });

  it('shows the ask box and routes each tool tile', async () => {
    let tree;
    await act(async () => {
      tree = create(<SommelierScreen />);
    });
    await flush();

    expect(tree.root.findByProps({ accessibilityLabel: 'Ask your sommelier a question' })).toBeTruthy();

    const expectRoute = (testID, route) => {
      act(() => tile(tree, testID).props.onPress());
      expect(mockPush).toHaveBeenLastCalledWith(route);
    };
    expectRoute('tool-wine-list', '/sommelier/wine-list');
    expectRoute('tool-taste', '/sommelier/taste');
    expectRoute('tool-trip', '/trips/new');
  });

  it('marks the tools as Pro for a free user and not for Pro', async () => {
    let tree;
    await act(async () => {
      tree = create(<SommelierScreen />);
    });
    await flush();
    expect(tile(tree, 'tool-taste').props.accessibilityLabel).toBe('My taste. Part of Pro.');

    usePro.mockReturnValue({
      gate: () => true,
      isPro: true,
      isLoading: false,
      remaining: () => null,
      presentPaywall: jest.fn(),
    });
    await act(async () => {
      tree.update(<SommelierScreen />);
    });
    await flush();
    expect(tile(tree, 'tool-taste').props.accessibilityLabel).toBe('My taste');
  });

  it('starts a chat and sends the question typed into the ask box', async () => {
    let tree;
    await act(async () => {
      tree = create(<SommelierScreen />);
    });
    await flush();

    const input = tree.root.findByProps({ accessibilityLabel: 'Ask your sommelier a question' });
    await act(async () => {
      input.props.onChangeText('What pairs with roast chicken?');
    });
    await act(async () => {
      input.props.onSubmitEditing();
    });
    await flush();

    expect(chatService.createConversation).toHaveBeenCalledWith('general');
    expect(chatService.addMessage).toHaveBeenCalledWith(
      'conv-1',
      'user',
      'What pairs with roast chicken?',
      expect.anything()
    );
    expect(aiService.sendMessage).toHaveBeenCalled();
    // Let the chat view's scroll-to-end timer fire inside the test environment.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });
  });
});
