// app/(tabs)/profile.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useContext } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import VisitStatsCard from '../../components/VisitStatsCard';
import { createThemedStyles } from '../../styles/ThemeProvider';
import { AuthContext } from '../_layout';


export default function ProfileScreen() {
  const { colors, styles } = useScreenTheme();

  const { signOut, user } = useContext(AuthContext);
  const router = useRouter();

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Get user's initials for avatar
  const getInitials = () => {
    const name = user?.user_metadata?.name || user?.email?.split('@')[0] || 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          {/* Hidden tab route (flat-five bar, #203): Profile is reached from
              the Home avatar, so a real back chevron replaces the old
              decorative wine mark. */}
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary.ink} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.headerRight}
            onPress={() => router.push('/profile/account-settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <Ionicons name="settings-outline" size={22} color={colors.neutral.ink} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerBorder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* User Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials()}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.name}>
            {user?.user_metadata?.name || user?.email?.split('@')[0] || 'Wine Enthusiast'}
          </Text>
          <Text style={styles.email}>{user?.email || 'user@example.com'}</Text>

          {/* Decorative divider */}
          <View style={styles.headerDivider}>
            <View style={styles.dividerLine} />
            <View style={styles.dividerDiamond} />
            <View style={styles.dividerLine} />
          </View>
        </View>

        {/* Visit Stats */}
        <View style={styles.statsContainer}>
          <VisitStatsCard />
        </View>

        {/* Your journal — the IA promise from the June doc, restored (#170 item 1):
            direct rows to everything you've logged, always visible. */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>YOUR JOURNAL</Text>
          </View>

          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/wines')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="wine" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Your tastings</Text>
                <Text style={styles.menuSubtext}>Every wine you&apos;ve logged</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/places')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="location-outline" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Your places</Text>
                <Text style={styles.menuSubtext}>Wineries and spots you&apos;ve visited</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/wishlist')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="bookmark-outline" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Wishlist</Text>
                <Text style={styles.menuSubtext}>Places you want to visit</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => router.push('/(tabs)/cellar')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="file-tray-stacked-outline" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Cellar</Text>
                <Text style={styles.menuSubtext}>The bottles you own</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sommelier Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>SOMMELIER</Text>
          </View>

          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => router.push('/(tabs)/sommelier')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="sparkles" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Ask the sommelier</Text>
                <Text style={styles.menuSubtext}>Personalized to the wines you&apos;ve rated</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>SETTINGS</Text>
          </View>

          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/profile/account-settings')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="settings-outline" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Account settings</Text>
                <Text style={styles.menuSubtext}>Manage your account preferences</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/profile/notifications')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="notifications-outline" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Cellar reminders</Text>
                <Text style={styles.menuSubtext}>Gentle nudges when bottles hit their peak</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/profile/help-support')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="help-circle-outline" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Help & support</Text>
                <Text style={styles.menuSubtext}>Get assistance and FAQs</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/profile/feedback')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Feedback</Text>
                <Text style={styles.menuSubtext}>Share your thoughts with us</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/profile/privacy-policy')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Privacy policy</Text>
                <Text style={styles.menuSubtext}>How your data is handled</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => router.push('/profile/terms-of-use')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary.ink} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Terms of use</Text>
                <Text style={styles.menuSubtext}>The agreement for using Cork & Note</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accent.strong} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Account Actions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
          </View>

          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.status.error} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Cork & Note</Text>
          <Text style={styles.footerVersion}>
            Version {Constants.expoConfig?.version ?? 'unknown'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}




const useScreenTheme = createThemedStyles((theme) => {
const { colors, typography, spacing, shadows, borderRadius } = theme;

const SERIF = typography.fonts.serif;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },

  // Custom Header
  header: {
    backgroundColor: colors.neutral.bg,
    paddingTop: 60, // Safe area for iOS
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  headerTitle: {
    ...typography.heading.h2,
    color: colors.neutral.ink,
    fontFamily: SERIF,
  },
  headerRight: {
    // 44pt minimum touch target (launch plan §3.3)
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.neutral.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  headerBorder: {
    height: 1,
    backgroundColor: colors.accent.border,
    marginHorizontal: spacing.lg,
  },

  scrollContent: {
    paddingBottom: spacing.xxl,
  },

  // Profile Header
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 2,
    borderColor: colors.accent.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary.base,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.onPrimary,
    fontFamily: SERIF,
    letterSpacing: 2,
  },
  name: {
    ...typography.heading.h1,
    color: colors.neutral.ink,
    fontFamily: SERIF,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  email: {
    ...typography.body.regular,
    color: colors.neutral.inkTertiary,
    marginBottom: spacing.lg,
  },

  // Header Divider
  headerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 120,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.accent.border,
  },
  dividerDiamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.accent.base,
    transform: [{ rotate: '45deg' }],
    marginHorizontal: spacing.sm,
  },

  // Stats Container
  statsContainer: {
    paddingHorizontal: spacing.lg,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionLabel: {
    ...typography.body.caption,
    color: colors.accent.ink,
  },

  // Menu Container
  menuContainer: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    overflow: 'hidden',
    ...shadows.soft,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.divider,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent.border,
  },
  menuContent: {
    flex: 1,
  },
  menuText: {
    ...typography.body.regular,
    color: colors.neutral.ink,
    fontWeight: '500',
    marginBottom: 2,
  },
  menuSubtext: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
  },

  // Sign Out Button
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.status.error,
    gap: spacing.sm,
  },
  signOutText: {
    ...typography.body.regular,
    color: colors.status.error,
    fontWeight: '500',
  },

  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  footerText: {
    ...typography.body.small,
    color: colors.neutral.inkTertiary,
    fontFamily: SERIF,
    fontStyle: 'italic',
  },
  footerVersion: {
    ...typography.body.caption,
    color: colors.neutral.inkTertiary,
    marginTop: spacing.xs,
  },
});
return { colors, styles };
});
