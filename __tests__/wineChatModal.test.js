import { act, create } from 'react-test-renderer';
import { Modal } from 'react-native';
import WineChatModal from '../components/WineChatModal';
import { aiService } from '../lib/ai';
import { chatService } from '../lib/chat';

const mockInput = jest.fn(() => null);
const mockBubble = jest.fn(() => null);
jest.mock('../components/ChatInput', () => (props) => mockInput(props));
jest.mock('../components/ChatBubble', () => (props) => mockBubble(props));
jest.mock('../components/MeterHint', () => () => null);
jest.mock('../components/TypingDots', () => () => null);
jest.mock('../hooks/usePro', () => ({
  usePro: () => ({ gate: () => true, isPro: true, presentPaywall: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, right: 0, bottom: 34, left: 0 }),
}));
jest.mock('../lib/ai', () => ({
  aiService: {
    buildSystemPrompt: jest.fn(),
    sendChatMessage: jest.fn(),
    parseSuggestions: jest.fn(),
    getDisplayText: jest.fn((value) => value),
    photoToBase64: jest.fn(),
  },
}));
jest.mock('../lib/chat', () => ({
  chatService: {
    createConversation: jest.fn().mockResolvedValue({ id: 'conversation-1' }),
    getConversation: jest.fn(),
    getMessages: jest.fn().mockResolvedValue([]),
    addMessage: jest.fn(),
    generateTitle: jest.fn(() => 'Taste this wine'),
    updateConversationTitle: jest.fn().mockResolvedValue(undefined),
    uploadChatPhoto: jest.fn(),
  },
}));

const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const latestInput = () => mockInput.mock.calls.at(-1)[0];

beforeEach(() => {
  jest.clearAllMocks();
  chatService.createConversation.mockResolvedValue({ id: 'conversation-1' });
  chatService.getMessages.mockResolvedValue([]);
  chatService.updateConversationTitle.mockResolvedValue(undefined);
});

test('opens full screen and blocks sending until the form-aware prompt is ready', async () => {
  let finishPrompt;
  aiService.buildSystemPrompt.mockReturnValue(new Promise((resolve) => { finishPrompt = resolve; }));
  let tree;
  await act(async () => {
    tree = create(<WineChatModal visible onClose={jest.fn()} currentWineData={{ winemaker: 'Honig' }} />);
  });

  const modal = tree.root.findByType(Modal);
  expect(modal.props.presentationStyle).toBe('fullScreen');
  expect(modal.props.transparent).not.toBe(true);
  expect(latestInput().disabled).toBe(true);

  await act(async () => finishPrompt('GENERAL PROMPT'));
  await flush();
  expect(latestInput().disabled).toBe(false);
  await act(async () => tree.unmount());
});

test('sends the explicit form-action contract and exposes returned fields to Apply', async () => {
  aiService.buildSystemPrompt.mockResolvedValue('GENERAL PROMPT');
  const suggestions = {
    winemaker: 'Honig Vineyard & Winery',
    wine_name: 'Cabernet Sauvignon',
    overall_rating: 4,
  };
  const response = `I filled in what we know.\n\n\`\`\`wine_suggestions\n${JSON.stringify(suggestions)}\n\`\`\``;
  aiService.sendChatMessage.mockResolvedValue({ response, sources: [] });
  aiService.parseSuggestions.mockReturnValue(suggestions);
  chatService.addMessage.mockImplementation(async (_id, role, content, _images, aiSuggestions) => ({
    id: role === 'user' ? 'user-1' : 'assistant-1',
    role,
    content,
    ai_suggestions: aiSuggestions,
    created_at: '2026-09-11T12:00:00Z',
  }));
  const onUseSuggestions = jest.fn();

  let tree;
  await act(async () => {
    tree = create(
      <WineChatModal
        visible
        onClose={jest.fn()}
        onUseSuggestions={onUseSuggestions}
        currentWineData={{ winemaker: 'Honig Vineyard & Winery', name: 'Cabernet Sauvignon', overallRating: 4 }}
      />
    );
  });
  await flush();
  await act(async () => latestInput().onSend('Fill in this tasting for me'));
  await flush();

  const sentPrompt = aiService.sendChatMessage.mock.calls[0][1];
  expect(sentPrompt).toContain('Winemaker: Honig Vineyard & Winery');
  expect(sentPrompt).toContain('app CAN fill its fields');
  expect(sentPrompt).toContain('do not say that you cannot edit or access the form');

  expect(aiService.sendChatMessage).toHaveBeenCalledTimes(1);

  const assistant = mockBubble.mock.calls.map(([props]) => props).find((props) => props.message.role === 'assistant');
  expect(assistant.message.ai_suggestions).toEqual(suggestions);
  await act(async () => assistant.onUseSuggestions(suggestions));
  expect(onUseSuggestions).toHaveBeenCalledWith(suggestions);
  await act(async () => tree.unmount());
});
