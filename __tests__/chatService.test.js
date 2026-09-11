// lib/chat.js: conversation and message rows, the private chat-photos bucket,
// and the legacy public-URL to storage-path migration that display code
// depends on. Run for real against the in-memory client.
import { chatService } from '../lib/chat';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system';

jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));
jest.mock('expo-file-system', () => ({
  EncodingType: { Base64: 'base64' },
  readAsStringAsync: jest.fn(),
}));

const USER = { id: 'user-a', email: 'a@example.com' };

beforeEach(() => {
  supabase.reset({ user: USER, tables: { conversations: [], messages: [] } });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  FileSystem.readAsStringAsync.mockResolvedValue('aGVsbG8=');
});
afterEach(() => console.error.mockRestore());

describe('conversations and messages', () => {
  test('a new conversation is owned by the user with a placeholder title and its context', async () => {
    const convo = await chatService.createConversation('wine', { wineId: 9 });
    expect(convo).toEqual(expect.objectContaining({
      user_id: USER.id, title: 'New Conversation', context_type: 'wine', context_metadata: { wineId: 9 },
    }));
    expect(supabase.tables.conversations).toHaveLength(1);
  });

  test('listing is scoped to the user and newest first', async () => {
    supabase.tables.conversations.push(
      { id: 1, user_id: USER.id, title: 'old', updated_at: '2026-09-01' },
      { id: 2, user_id: 'user-b', title: 'not mine', updated_at: '2026-09-11' },
      { id: 3, user_id: USER.id, title: 'new', updated_at: '2026-09-10' },
    );
    const list = await chatService.getConversations();
    expect(list.map((c) => c.title)).toEqual(['new', 'old']);
  });

  test('messages are returned oldest first with their photos and suggestions', async () => {
    const convo = await chatService.createConversation();
    await chatService.addMessage(convo.id, 'user', 'What pairs with oysters?', ['chat_user-a_1.jpg']);
    await chatService.addMessage(convo.id, 'assistant', 'A crisp Muscadet.', [], [{ name: 'Muscadet' }]);
    const messages = await chatService.getMessages(convo.id);
    expect(messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    expect(messages[0]).toEqual(expect.objectContaining({ image_urls: ['chat_user-a_1.jpg'], ai_suggestions: null }));
    expect(messages[1].ai_suggestions).toEqual([{ name: 'Muscadet' }]);
  });

  test('per-conversation reads and writes carry no user filter: row-level security is the only owner check', async () => {
    // Pinned on purpose: if this assertion starts failing because a user_id
    // filter was added, update the RLS probe expectations too.
    await chatService.getMessages(5);
    await chatService.updateConversationTitle(5, 'x');
    await chatService.deleteConversation(5);
    for (const call of supabase.calls) {
      expect(call.filters.map((f) => f.column)).not.toContain('user_id');
    }
  });

  test('every call fails loudly without a session', async () => {
    supabase.setUser(null);
    await expect(chatService.createConversation()).rejects.toThrow('Not authenticated');
    await expect(chatService.getConversations()).rejects.toThrow('Not authenticated');
    await expect(chatService.uploadChatPhoto('file:///x.jpg')).rejects.toThrow('Not authenticated');
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  test('a database error is thrown to the caller, not swallowed', async () => {
    supabase.respond('messages', () => ({ data: null, error: { message: 'permission denied' } }));
    await expect(chatService.addMessage(1, 'user', 'hi')).rejects.toEqual({ message: 'permission denied' });
  });
});

describe('chat photos', () => {
  test('uploads decoded bytes to the private bucket under an owner-stamped name and returns the path', async () => {
    const path = await chatService.uploadChatPhoto('file:///tmp/label.jpg');
    expect(path).toMatch(/^chat_user-a_\d+_[a-z0-9]+\.jpg$/);
    const [upload] = supabase.calls.filter((c) => c.op === 'upload');
    expect(upload).toEqual(expect.objectContaining({ table: 'storage:chat-photos', path, size: 5, options: { contentType: 'image/jpeg', upsert: false } }));
  });

  test('a storage error is thrown so the send can fail visibly', async () => {
    supabase.storage.from('chat-photos').upload.mockResolvedValueOnce({ data: null, error: { message: 'bucket full' } });
    await expect(chatService.uploadChatPhoto('file:///tmp/label.jpg')).rejects.toEqual({ message: 'bucket full' });
  });

  test.each([
    ['chat_user-a_1.jpg', 'chat_user-a_1.jpg'],
    ['https://x.supabase.co/storage/v1/object/public/chat-photos/chat_user-a_1.jpg', 'chat_user-a_1.jpg'],
    ['https://x.supabase.co/storage/v1/object/public/chat-photos/chat_user-a_1.jpg?t=123', 'chat_user-a_1.jpg'],
    ['https://x.supabase.co/storage/v1/object/public/chat-photos/chat%20one.jpg', 'chat one.jpg'],
    [null, null],
    ['', ''],
  ])('normalizes %s to the storage path %s', (input, expected) => {
    expect(chatService._toStoragePath(input)).toBe(expected);
  });

  test('signed URLs come back aligned to the input, with legacy URLs resolved to paths first', async () => {
    const urls = await chatService.getSignedUrls([
      'chat_user-a_1.jpg',
      'https://x.supabase.co/storage/v1/object/public/chat-photos/chat_user-a_2.jpg',
    ], 600);
    expect(supabase.storage.from('chat-photos').createSignedUrls).toHaveBeenCalledWith(['chat_user-a_1.jpg', 'chat_user-a_2.jpg'], 600);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('/sign/chat-photos/chat_user-a_1.jpg');
    expect(urls[1]).toContain('/sign/chat-photos/chat_user-a_2.jpg');
  });

  test('a signing failure yields one null per photo instead of throwing', async () => {
    supabase.storage.from('chat-photos').createSignedUrls.mockResolvedValueOnce({ data: null, error: { message: 'nope' } });
    expect(await chatService.getSignedUrls(['a.jpg', 'b.jpg'])).toEqual([null, null]);
    expect(await chatService.getSignedUrls([])).toEqual([]);
  });
});

describe('generateTitle', () => {
  test('uses the first line of the first message, cut to 50 characters with an ellipsis', () => {
    expect(chatService.generateTitle('What pairs with oysters?')).toBe('What pairs with oysters?');
    expect(chatService.generateTitle('  line one\nline two  ')).toBe('line one line two');
    const long = 'x'.repeat(60);
    expect(chatService.generateTitle(long)).toBe('x'.repeat(47) + '...');
    expect(chatService.generateTitle('x'.repeat(50))).toBe('x'.repeat(50));
  });
});
