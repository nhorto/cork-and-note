// app/profile/account-settings.js
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import AppearanceSettings from '../../components/AppearanceSettings';
import AiSharingSettings from '../../components/AiSharingSettings';
import { usePro } from '../../hooks/usePro';
import { accountService } from '../../lib/account';
import { shareTastingsCsv } from '../../lib/exportTastings';
import { createThemedStyles } from '../../styles/ThemeProvider';
import { AuthContext } from '../_layout';


export default function AccountSettingsScreen() {
  const { colors, styles } = useScreenTheme();

  const router = useRouter();
  const { user, signOut } = useContext(AuthContext);
  const { isPro, purchasesAvailable, restore, presentPaywall } = usePro();

  // Local state for settings
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Required on the paywall AND in Settings by App Store guideline 3.1.2. It is
  // also the only way back for someone who reinstalled or changed device, so it
  // must be here even when we believe they are already Pro.
  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    const result = await restore();
    setRestoring(false);
    if (result.isPro) {
      Alert.alert('Welcome back', 'Your Cork & Note Pro subscription has been restored.');
      return;
    }
    Alert.alert(
      'Nothing to restore',
      result.error || 'We could not find a previous purchase for this Apple Account.'
    );
  };

  // CSV export is the one Pro feature that is not about cost — it is about the
  // journal being the user's. Free users see the row and the paywall rather than
  // a hidden feature they never learn exists.
  const handleExport = async () => {
    if (exporting) return;
    if (!isPro) {
      presentPaywall('export');
      return;
    }
    setExporting(true);
    const result = await shareTastingsCsv();
    setExporting(false);
    if (!result.success) {
      Alert.alert('Export failed', result.error);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await accountService.deleteAccount();
      // The account is gone server-side; signing out clears the local session
      // and the auth listener in _layout routes back to the login screen.
      await signOut();
    } catch (error) {
      Alert.alert(
        'Account deletion failed',
        error.message || 'Something went wrong. Please try again.'
      );
    } finally {
      setDeleting(false);
    }
  };

  // Check current location permission status on component mount
  useEffect(() => {
    checkLocationPermission();
    // Permission can only be revoked in the OS settings. Refresh the switch
    // when the user comes back so it always reflects the real system state.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkLocationPermission();
    });
    return () => subscription.remove();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermissionStatus(status);
      setLocationEnabled(status === 'granted');
    } catch (error) {
      console.error('Error checking location permission:', error);
    }
  };

  const handleLocationToggle = async (value) => {
    if (value) {
      // User wants to enable location - request permission
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          setLocationEnabled(true);
          setLocationPermissionStatus('granted');
          Alert.alert(
            'Location Enabled', 
            'Location services are now enabled. The app can now find nearby wineries and show your location on the map.'
          );
        } else {
          setLocationEnabled(false);
          setLocationPermissionStatus(status);
          Alert.alert(
            'Location access is off',
            'Cork & Note cannot change this permission from inside the app. Open device settings and allow location access to use your position on the map.',
            [
              { text: 'Not now', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
          );
        }
      } catch (error) {
        console.error('Error requesting location permission:', error);
        Alert.alert('Error', 'Unable to request location permission.');
      }
    } else {
      // iOS and Android only let the user revoke an existing grant in device
      // settings. Keep the switch in sync with the actual permission until the
      // user changes it there.
      Alert.alert(
        'Change location access',
        'Open device settings to turn off location access for Cork & Note.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Account settings" />

      <ScrollView style={styles.content}>
        <AppearanceSettings />
        {/* Privacy & Permissions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & permissions</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Location services</Text>
              <Text style={styles.settingDescription}>
                Allow location access to find nearby wineries and show your location on the map
              </Text>
              {locationPermissionStatus && (
                <Text style={[
                  styles.permissionStatus, 
                  { color: locationPermissionStatus === 'granted' ? colors.status.success : colors.status.error }
                ]}>
                  Status: {locationPermissionStatus === 'granted' ? 'Enabled' : 'Disabled'}
                </Text>
              )}
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={handleLocationToggle}
              trackColor={{ false: colors.neutral.border, true: colors.primary.base }}
              thumbColor={colors.onPrimary}
            />
          </View>
        </View>

        <View style={styles.section}>
          <AiSharingSettings userId={user?.id} />
        </View>

        {/* Subscription Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plan:</Text>
            <Text style={styles.infoValue}>{isPro ? 'Cork & Note Pro' : 'Free'}</Text>
          </View>

          {!isPro && purchasesAvailable ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => presentPaywall('settings')}
              accessibilityRole="button"
            >
              <Ionicons name="sparkles" size={20} color={colors.primary.ink} />
              <Text style={styles.actionButtonText}>Upgrade to Pro</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.accent.strong} />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.actionButton, styles.lastButton]}
            disabled={restoring}
            onPress={handleRestore}
            accessibilityRole="button"
          >
            <Ionicons name="refresh" size={20} color={colors.primary.ink} />
            <Text style={styles.actionButtonText}>
              {restoring ? 'Restoring…' : 'Restore purchases'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.accent.strong} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} accessibilityRole="link" onPress={() =>
            Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() =>
              Alert.alert('Could not open subscriptions', 'Manage your subscription in your Apple Account settings.'))
          }>
            <Ionicons name="card-outline" size={20} color={colors.primary.ink} />
            <Text style={styles.actionButtonText}>Manage subscription</Text>
          </TouchableOpacity>
          <Text style={styles.infoNote}>
            Subscriptions are billed to your Apple Account and can be managed or cancelled there.
          </Text>
        </View>

        {/* Your Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your data</Text>

          <TouchableOpacity
            style={[styles.actionButton, styles.lastButton]}
            disabled={exporting}
            onPress={handleExport}
            accessibilityRole="button"
          >
            <Ionicons name="download" size={20} color={colors.primary.ink} />
            <Text style={styles.actionButtonText}>
              {exporting ? 'Preparing export…' : 'Export tastings (CSV)'}
            </Text>
            {isPro ? (
              <Ionicons name="chevron-forward" size={20} color={colors.accent.strong} />
            ) : (
              <Text style={styles.proBadge}>PRO</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.infoNote}>
            A spreadsheet of every tasting you&apos;ve logged — one row per wine, yours to keep.
          </Text>
        </View>

        {/* Account Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/profile/change-password')}
          >
            <Ionicons name="key" size={20} color={colors.primary.ink} />
            <Text style={styles.actionButtonText}>Change password</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.accent.strong} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.dangerButton]}
            disabled={deleting}
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'This permanently deletes your account, tastings, photos, cellar and chat history. This cannot be undone. Deleting your account does not cancel an Apple subscription: billing continues until you cancel it in your Apple Account settings. You can manage your subscription here before deleting, or delete your account now.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Manage subscription', onPress: () => Linking.openURL('https://apps.apple.com/account/subscriptions').catch(() => Alert.alert('Could not open subscriptions', 'Open your Apple Account subscription settings.')) },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: handleDeleteAccount
                  }
                ]
              );
            }}
          >
            <Ionicons name="trash" size={20} color={colors.status.error} />
            <Text style={[styles.actionButtonText, styles.dangerText]}>
              {deleting ? 'Deleting account…' : 'Delete account'}
            </Text>
            <Ionicons name="chevron-forward" size={20} color={colors.accent.strong} />
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user?.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name:</Text>
            <Text style={styles.infoValue}>{user?.user_metadata?.name || 'Not provided'}</Text>
          </View>
          <Text style={styles.infoNote}>
            Your name cannot be changed after account creation. Contact support if you need assistance.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}



const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.neutral.surface,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginBottom: 15,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  settingInfo: {
    flex: 1,
    marginRight: 15,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.neutral.ink,
    marginBottom: 5,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.neutral.inkTertiary,
    lineHeight: 20,
  },
  permissionStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 5,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    color: colors.neutral.ink,
    marginLeft: 15,
  },
  dangerButton: {
    borderBottomWidth: 0,
  },
  // The last row in a section drops the divider hairline.
  lastButton: {
    borderBottomWidth: 0,
  },
  proBadge: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.primary.ink,
    borderWidth: 1,
    borderColor: colors.primary.base,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  dangerText: {
    color: colors.status.error,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.neutral.inkTertiary,
    width: 60,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: colors.neutral.ink,
    flex: 1,
  },
  infoNote: {
    fontSize: 12,
    color: colors.neutral.inkTertiary,
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 16,
  },
});
return { colors, styles };
});
