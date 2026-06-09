// app/log-session.js
// Full-screen host for the location-optional logging flow (Epic #5).
// Reached from the ＋Log tab's two entry points:
//   /log-session?mode=wine    → B-first (log one wine, place optional)
//   /log-session?mode=winery  → A-first (start a session, place = winery)
// Mirrors the app/winery/[id].js pattern (a route outside (tabs) so it
// covers the tab bar). Saving goes through visitsService.createVisit, which
// already accepts a nullable winery + place_type/place_name/lat/lng.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import LogSessionForm from '../components/LogSessionForm';
import { visitsService } from '../lib/visits';

export default function LogSessionScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams();
  const [submitting, setSubmitting] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  const handleSave = async (visitData) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = await visitsService.createVisit(visitData);
      if (!result?.success) {
        Alert.alert('Could not save', result?.error || 'Something went wrong. Please try again.');
        return;
      }
      const count = visitData.wines?.length || 0;
      router.replace('/(tabs)/home');
      Alert.alert(
        'Logged',
        count > 1 ? `Your session of ${count} wines was saved.` : 'Your wine was saved.'
      );
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LogSessionForm
      mode={mode === 'winery' ? 'winery' : 'wine'}
      onSave={handleSave}
      onCancel={goBack}
    />
  );
}
