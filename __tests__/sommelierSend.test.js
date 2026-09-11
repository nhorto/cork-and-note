// What the Sommelier tab does when a send fails. The server refuses a free
// user's sixth message of the month with a 402 whose code is
// `free_limit_reached`; every other AI surface opens the paywall on that code
// (isPaywallError), and this tab must too. A dropped connection, by contrast,
// must NOT open the paywall: it gets an error bubble the user can retry from.
import { act, create } from 'react-test-renderer';

import { usePro } from '../hooks/usePro';
import { aiService } from '../lib/ai';
import SommelierScreen from '../app/(tabs)/sommelier';

const mockPush = jest.fn();
const mockBubble = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, setParams: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('../hooks/usePro', () => ({ usePro: jest.fn() }));
jest.mock('../components/ScreenHeader', () => () => null);
jest.mock('../components/TonightsPickCard', () => () => null);
jest.mock('../components/ChatBubble', () => (props) => { mockBubble(props); return null; });
jest.mock('../components/ChatInput', () => () => null);
jest.mock('../components/TypingDots', () => () => null);
jest.mock('../components/MeterHint', () => () => null);
jest.mock('../components/ProUpsellCard', () => () => null);
jest.mock('../components/UpgradePill', () => () => null);
jest.mock('../lib/ai', () => ({
  aiService: {
    buildSystemPrompt: jest.fn().mockResolvedValue('system'),
    sendMessage: jest.fn(),
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
    addMessage: jest.fn().mockResolvedValue({ id: 'm1', role: 'user', content: 'q' }),
    generateTitle: (t) => t.slice(0, 20),
    updateConversationTitle: jest.fn().mockResolvedValue(undefined),
    uploadChatPhoto: jest.fn(),
    deleteConversation: jest.fn(),
  },
}));

const flush = async () => {
  for (let i = 0; i < 4; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  }
};

async function askFromHub(question) {
  let tree;
  await act(async () => { tree = create(<SommelierScreen />); });
  await flush();
  const input = tree.root.findByProps({ accessibilityLabel: 'Ask your sommelier a question' });
  await act(async () => { input.props.onChangeText(question); });
  await act(async () => { input.props.onSubmitEditing(); });
  await flush();
  await act(async () => { await new Promise((r) => setTimeout(r, 150)); });
  return tree;
}

const assistantBubbles = () => mockBubble.mock.calls.map(([p]) => p.message).filter((m) => m?.role === 'assistant');

let presentPaywall;
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  presentPaywall = jest.fn();
  // A free user with an unknown remaining count: the client lets the send
  // through and the server is the one that decides.
  usePro.mockReturnValue({ gate: () => true, isPro: false, isLoading: false, remaining: () => null, presentPaywall });
});
afterEach(() => console.error.mockRestore());

test('a server paywall refusal opens the paywall instead of impersonating the sommelier', async () => {
  const refusal = new Error('You have used your 5 free sommelier messages this month.');
  refusal.code = 'free_limit_reached';
  aiService.sendMessage.mockRejectedValueOnce(refusal);

  await askFromHub('What pairs with oysters?');

  expect(presentPaywall).toHaveBeenCalledWith('chat');
  const errorBubbles = assistantBubbles().filter((m) => /encountered an error/i.test(m.content));
  expect(errorBubbles).toEqual([]);
});

test('a dropped connection shows a retryable error bubble and never opens the paywall', async () => {
  aiService.sendMessage.mockRejectedValueOnce(new Error('Network request failed'));

  await askFromHub('What pairs with oysters?');

  expect(presentPaywall).not.toHaveBeenCalled();
  const bubble = assistantBubbles().find((m) => /encountered an error/i.test(m.content));
  expect(bubble).toBeTruthy();
  expect(bubble.content).toContain('Network request failed');
});
