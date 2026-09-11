import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export const AI_SHARING_VERSION = 2;
const key = (userId) => `ai-sharing-consent:v${AI_SHARING_VERSION}:${userId}`;
const legacyKey = (userId) => `ai-sharing-consent:v1:${userId}`;
const pending = new Map();
const listeners = new Set();

export const AI_SHARING_DISCLOSURE = 'To provide AI suggestions, Cork & Note sends wine-label, tasting-card, and wine-list scan photos and their extraction instructions to Google Gemini. Your sommelier messages, attached chat photos, and relevant tasting notes and cellar details go to Anthropic. Pro can also search the web: queries based on your conversation go to Anthropic’s search provider. AI can make mistakes. You can turn this off in Account settings and keep using your journal without AI.';

export async function getAiConsent(userId) {
  if (!userId) return false;
  const value = await AsyncStorage.getItem(key(userId));
  if (value === 'allowed') return true;
  if (value === 'declined') return false;
  // Preserve an existing opt-out; an old opt-in must see the new provider disclosure.
  return (await AsyncStorage.getItem(legacyKey(userId))) === 'declined' ? false : null;
}

export async function setAiConsent(userId, allowed) {
  if (!userId) throw new Error('Sign in before changing AI permissions.');
  await AsyncStorage.setItem(key(userId), allowed ? 'allowed' : 'declined');
  listeners.forEach((listener) => listener(userId, allowed));
}

export function onAiConsentChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function aiConsentError() {
  const error = new Error('AI sharing is off. You can enable it in Profile → Account settings. Your journal is still available.');
  error.code = 'ai_consent_required';
  return error;
}

/** One prompt per account, including simultaneous automatic AI requests. */
export function requestAiConsent(userId, { promptAgain = false } = {}) {
  if (!userId) return Promise.resolve(false);
  if (pending.has(userId)) return pending.get(userId);
  const request = (async () => {
    const current = await getAiConsent(userId);
    if (current === true) return true;
    if (current === false && !promptAgain) return false;
    const allowed = await new Promise((resolve) => {
      Alert.alert('Allow AI sharing?', AI_SHARING_DISCLOSURE, [
        { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Allow AI sharing', onPress: () => resolve(true) },
      ], { cancelable: true, onDismiss: () => resolve(false) });
    });
    await setAiConsent(userId, allowed);
    return allowed;
  })();
  pending.set(userId, request);
  return request.finally(() => pending.delete(userId));
}

export async function requireAiConsent(userId) {
  if (!(await requestAiConsent(userId))) throw aiConsentError();
}
