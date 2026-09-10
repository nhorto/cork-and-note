import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { getAiConsent, requestAiConsent, requireAiConsent, setAiConsent } from '../lib/aiConsent';

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

it('blocks AI after decline without repeatedly prompting on automatic requests', async () => {
  const prompt = jest.spyOn(Alert, 'alert').mockImplementation((title, text, actions) => actions[0].onPress());
  await expect(requireAiConsent('user-a')).rejects.toMatchObject({ code: 'ai_consent_required' });
  await expect(requireAiConsent('user-a')).rejects.toMatchObject({ code: 'ai_consent_required' });
  expect(prompt).toHaveBeenCalledTimes(1);
});

it('shares one prompt across simultaneous requests and scopes consent to the account', async () => {
  const prompt = jest.spyOn(Alert, 'alert').mockImplementation((title, text, actions) => actions[1].onPress());
  await Promise.all([requireAiConsent('user-a'), requireAiConsent('user-a')]);
  expect(prompt).toHaveBeenCalledTimes(1);
  expect(await getAiConsent('user-a')).toBe(true);
  expect(await getAiConsent('user-b')).toBeNull();
});

it('supports withdrawal and explicit permission to re-enable AI', async () => {
  await setAiConsent('user-a', true);
  await setAiConsent('user-a', false);
  await expect(requireAiConsent('user-a')).rejects.toThrow();
  jest.spyOn(Alert, 'alert').mockImplementation((title, text, actions) => actions[1].onPress());
  await expect(requestAiConsent('user-a', { promptAgain: true })).resolves.toBe(true);
});
