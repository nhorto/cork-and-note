// app/log-session.js
// Full-screen host for the location-optional logging flow (Epic #5).
// Reached from the ＋Log tab's two entry points:
//   /log-session?mode=wine    → B-first (log one wine, place optional)
//   /log-session?mode=winery  → A-first (start a session, place = winery)
// Also reached from a winery detail page's "Log Visit" action (#21), which
// passes the winery so the place pre-fills:
//   /log-session?mode=winery&wineryId=<id>&wineryName=<name>&lat=<n>&lng=<n>
// And, for editing a saved log (#42):
//   /log-session?editVisitId=<id>
// Mirrors the app/winery/[id].js pattern (a route outside (tabs) so it
// covers the tab bar). Saving goes through visitsService.createVisit on the
// create path, or visitsService.updateSession on the edit path.
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import LogSessionForm from '../components/LogSessionForm';
import { visitsService } from '../lib/visits';
import theme from '../styles/theme';

const { colors } = theme;

// Build a trailing sentence when some photos couldn't be uploaded, so a dropped
// photo surfaces to the user instead of vanishing silently (#128). Empty string
// when nothing failed.
const photoFailureNote = (failed) => {
  if (!failed || failed < 1) return '';
  const plural = failed > 1;
  return ` However, ${failed} photo${plural ? 's' : ''} couldn't be uploaded — open the wine to add ${plural ? 'them' : 'it'} again.`;
};

export default function LogSessionScreen() {
  const router = useRouter();
  const { mode, wineryId, wineryName, lat, lng, editVisitId } = useLocalSearchParams();
  const [submitting, setSubmitting] = useState(false);

  // Edit mode: load the saved session to hydrate the form.
  const isEditing = !!editVisitId;
  const [initialSession, setInitialSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(isEditing);

  useEffect(() => {
    if (!editVisitId) return;
    let active = true;
    (async () => {
      setLoadingSession(true);
      const result = await visitsService.getVisit(editVisitId);
      if (!active) return;
      if (result?.success && result.visit) {
        setInitialSession(result.visit);
      } else {
        Alert.alert('Could not open log', result?.error || 'This log could not be loaded.');
        goBack();
      }
      setLoadingSession(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editVisitId]);

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

    // Editing + all wines removed → confirm-and-delete instead of saving empty.
    if (isEditing && (visitData.wines?.length || 0) === 0) {
      Alert.alert(
        'Remove this log?',
        'You removed all wines. Deleting them removes the whole log.',
        [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Delete log',
            style: 'destructive',
            onPress: async () => {
              setSubmitting(true);
              try {
                const result = await visitsService.deleteVisit(editVisitId);
                if (!result?.success) {
                  Alert.alert('Could not delete', result?.error || 'Something went wrong.');
                  return;
                }
                goBack();
                Alert.alert('Log removed', 'Your log was deleted.');
              } finally {
                setSubmitting(false);
              }
            },
          },
        ]
      );
      return;
    }

    setSubmitting(true);
    try {
      if (isEditing) {
        const result = await visitsService.updateSession(editVisitId, visitData);
        if (!result?.success) {
          Alert.alert(
            'Could not save changes',
            result?.error || 'Something went wrong. Please try again.'
          );
          return;
        }
        goBack();
        Alert.alert('Log updated', `Your changes were saved.${photoFailureNote(result.photosFailed)}`);
        return;
      }

      const result = await visitsService.createVisit(visitData);
      if (!result?.success) {
        Alert.alert('Could not save', result?.error || 'Something went wrong. Please try again.');
        return;
      }
      const count = visitData.wines?.length || 0;
      router.replace('/(tabs)/home');
      const savedMsg = count > 1 ? `Your session of ${count} wines was saved.` : 'Your wine was saved.';
      Alert.alert('Logged', `${savedMsg}${photoFailureNote(result.photosFailed)}`);
    } catch (e) {
      Alert.alert('Could not save', e.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isEditing && loadingSession) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary.burgundy} />
      </View>
    );
  }

  return (
    <LogSessionForm
      mode={mode === 'winery' ? 'winery' : 'wine'}
      winery={winery}
      initialSession={isEditing ? initialSession : null}
      onSave={handleSave}
      onCancel={goBack}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.cream,
  },
});
