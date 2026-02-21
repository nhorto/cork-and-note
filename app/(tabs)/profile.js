// app/(tabs)/profile.js
// Château Label Design - Elegant & Refined
import { Ionicons } from '@expo/vector-icons';
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
import theme from '../../styles/theme';
import { AuthContext } from '../_layout';

const { colors, typography, spacing, shadows, borderRadius } = theme;

export default function ProfileScreen() {
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
          <View style={styles.headerLeft}>
            <Ionicons name="wine" size={20} color={colors.primary.burgundy} />
          </View>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.headerRight}
            onPress={() => router.push('/profile/account-settings')}
          >
            <Ionicons name="settings-outline" size={22} color={colors.neutral.charcoal} />
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
                <Ionicons name="settings-outline" size={20} color={colors.primary.burgundy} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Account Settings</Text>
                <Text style={styles.menuSubtext}>Manage your account preferences</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gold.shimmer} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/profile/help-support')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="help-circle-outline" size={20} color={colors.primary.burgundy} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Help & Support</Text>
                <Text style={styles.menuSubtext}>Get assistance and FAQs</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gold.shimmer} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => router.push('/profile/feedback')}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="chatbubble-outline" size={20} color={colors.primary.burgundy} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuText}>Feedback</Text>
                <Text style={styles.menuSubtext}>Share your thoughts with us</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.gold.shimmer} />
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
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Cork & Note</Text>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },

  // Custom Header
  header: {
    backgroundColor: colors.neutral.cream,
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
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  headerTitle: {
    ...typography.heading.h2,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
  },
  headerRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.parchment,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
  },
  headerBorder: {
    height: 1,
    backgroundColor: colors.gold.muted,
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
    borderColor: colors.gold.muted,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary.burgundy,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '300',
    color: colors.neutral.cream,
    fontFamily: 'Georgia',
    letterSpacing: 2,
  },
  name: {
    ...typography.heading.h1,
    color: colors.neutral.charcoal,
    fontFamily: 'Georgia',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  email: {
    ...typography.body.regular,
    color: colors.neutral.pewter,
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
    backgroundColor: colors.gold.muted,
  },
  dividerDiamond: {
    width: 6,
    height: 6,
    backgroundColor: colors.gold.rich,
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
    color: colors.gold.shimmer,
  },

  // Menu Container
  menuContainer: {
    backgroundColor: colors.neutral.parchment,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    overflow: 'hidden',
    ...shadows.soft,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.linen,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.gold.muted,
  },
  menuContent: {
    flex: 1,
  },
  menuText: {
    ...typography.body.regular,
    color: colors.neutral.charcoal,
    fontWeight: '500',
    marginBottom: 2,
  },
  menuSubtext: {
    ...typography.body.small,
    color: colors.neutral.pewter,
  },

  // Sign Out Button
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral.parchment,
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
    color: colors.neutral.pewter,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  footerVersion: {
    ...typography.body.caption,
    color: colors.neutral.silver,
    marginTop: spacing.xs,
  },
});
