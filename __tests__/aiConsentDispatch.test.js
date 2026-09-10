import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { aiService } from '../lib/ai';
import { setAiConsent } from '../lib/aiConsent';
import { supabase } from '../lib/supabase';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() }, functions: { invoke: jest.fn() } } }));
jest.mock('../lib/cellar', () => ({ cellarService: {}, describeBottleForPrompt: jest.fn() }));
jest.mock('../lib/visits', () => ({ visitsService: {} }));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
  supabase.auth.getSession.mockReset().mockResolvedValue({ data: { session: { user: { id: 'user-a' } } } });
  supabase.functions.invoke.mockReset().mockResolvedValue({ data: { content: 'A suggestion' }, error: null });
});

it('never dispatches personal content when permission is declined', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => buttons[0].onPress());
  await expect(aiService.sendMessage([{ role: 'user', content: 'Private tasting' }], 'context')).rejects.toMatchObject({ code: 'ai_consent_required' });
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});

it('rechecks permission after journal context is prepared', async () => {
  await setAiConsent('user-a', true);
  jest.spyOn(aiService, 'buildSystemPrompt').mockImplementation(async () => {
    await setAiConsent('user-a', false);
    return 'Private journal context';
  });
  await expect(aiService.sendMessage([{ role: 'user', content: 'Pairing?' }])).rejects.toMatchObject({ code: 'ai_consent_required' });
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});

it('does not dispatch the old account context after an account switch', async () => {
  await setAiConsent('user-a', true);
  supabase.auth.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'user-a' } } } })
    .mockResolvedValueOnce({ data: { session: { user: { id: 'user-b' } } } });
  await expect(aiService.sendMessage([{ role: 'user', content: 'Pairing?' }], 'private context')).rejects.toThrow('sign in again');
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});
