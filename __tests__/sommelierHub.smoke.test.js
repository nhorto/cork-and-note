// Smoke test for the Sommelier tab's hub (2026-09-11, reshaped 2026-09-12):
// the ask box is the hero with no separate "new chat" button, its chips
// half-write a question instead of sending, the four guided tools route to
// their screens, and a question typed into the box starts a chat and sends it.
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
    sendChatMessage: jest.fn().mockResolvedValue({ response: 'Try a Cab Franc.', sources: [] }),
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
    addMessage: jest.fn().mockImplementation(async (_id, role, content) => ({
      id: role === 'user' ? 'user-1' : 'assistant-1', role, content,
    })),
    generateTitle: (t) => t.slice(0, 20),
    updateConversationTitle: jest.fn().mockResolvedValue(undefined),
    uploadChatPhoto: jest.fn(),
    deleteConversation: jest.fn().mockResolvedValue(undefined),
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
    // The purple "Start a new chat" button is gone; the idle send arrow opens
    // a blank chat and the input itself is the new chat.
    expect(tree.root.findAllByProps({ accessibilityLabel: 'Start a new sommelier chat' })).toHaveLength(0);
    expect(tree.root.findByProps({ accessibilityLabel: 'Open the sommelier' })).toBeTruthy();
    expect(tile(tree, 'tool-wine-list').props.accessibilityLabel).toBe(
      'Photograph a wine list. Part of Pro.'
    );
    expect(tile(tree, 'tool-tonight').props.accessibilityLabel).toBe(
      "Tonight's pick. Part of Pro."
    );

    const expectRoute = (testID, route) => {
      act(() => tile(tree, testID).props.onPress());
      expect(mockPush).toHaveBeenLastCalledWith(route);
    };
    expectRoute('tool-wine-list', '/sommelier/wine-list');
    expectRoute('tool-tonight', '/sommelier/tonight');
    expectRoute('tool-taste', '/sommelier/taste');
    expectRoute('tool-trip', '/trips/new');
  });

  it('a starter chip half-writes the question instead of sending it', async () => {
    let tree;
    await act(async () => {
      tree = create(<SommelierScreen />);
    });
    await flush();

    const chip = tree.root
      .findAllByProps({ accessibilityLabel: 'Pair a dish' })
      .find((n) => n.props.onPress);
    await act(async () => {
      chip.props.onPress();
    });
    const input = tree.root.findByProps({ accessibilityLabel: 'Ask your sommelier a question' });
    expect(input.props.value).toBe('What wine pairs with ');
    expect(chatService.createConversation).not.toHaveBeenCalled();
    expect(aiService.sendChatMessage).not.toHaveBeenCalled();
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

  it('discards a blank conversation when the user backs out without sending', async () => {
    let tree;
    await act(async () => {
      tree = create(<SommelierScreen />);
    });
    await flush();

    // The idle arrow opens a blank chat (a conversation row is created).
    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Open the sommelier' }).props.onPress();
    });
    await flush();
    expect(chatService.createConversation).toHaveBeenCalledWith('general');

    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Back' }).props.onPress();
    });
    await flush();
    expect(chatService.deleteConversation).toHaveBeenCalledWith('conv-1');
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
    expect(aiService.sendChatMessage).toHaveBeenCalled();
    // Let the chat view's scroll-to-end timer fire inside the test environment.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });
  });
});
