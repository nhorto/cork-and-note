// app/log-session.js
// Full-screen host for the location-optional logging flow (Epic #5).
// Reached from the ＋Log tab's two entry points:
//   /log-session?mode=wine    → B-first (log one wine, place optional)
//   /log-session?mode=winery  → A-first (start a session, place = winery)
// Also reached from a winery detail page's "Log Visit" action (#21), which
// passes the winery so the place pre-fills:
//   /log-session?mode=winery&wineryId=<id>&wineryName=<name>&lat=<n>&lng=<n>
// Mirrors the app/winery/[id].js pattern (a route outside (tabs) so it
// covers the tab bar). Saving goes through visitsService.createVisit, which
// already accepts a nullable winery + place_type/place_name/lat/lng.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert } from 'react-native';
import LogSessionForm from '../components/LogSessionForm';
import { visitsService } from '../lib/visits';

export default function LogSessionScreen() {
  const router = useRouter();
  const { mode, wineryId, wineryName, lat, lng } = useLocalSearchParams();
  const [submitting, setSubmitting] = useState(false);

  // When a winery is passed (from app/winery/[id].js), seed LogSessionForm's
  // `winery` prop so the place is pre-filled as that winery. Shape matches what
  // LogSessionForm expects: { id, name, latitude, longitude }.
  const winery = useMemo(() => {
    if (!wineryId) return null;
    return {
      id: wineryId,
      name: wineryName ?? null,
      latitude: lat != null ? Number(lat) : null,
      longitude: lng != null ? Number(lng) : null,
    };
  }, [wineryId, wineryName, lat, lng]);

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
      winery={winery}
      onSave={handleSave}
      onCancel={goBack}
    />
  );
}
