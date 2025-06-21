// app/(tabs)/profile.js
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
import { AuthContext } from '../_layout';

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

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* User Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={50} color="white" />
            </View>
          </View>
          {/* Name is now read-only and shows the original signup name */}
          <Text style={styles.name}>{user?.user_metadata?.name || user?.email?.split('@')[0] || 'Wine Enthusiast'}</Text>
          <Text style={styles.email}>{user?.email || 'user@example.com'}</Text>
        </View>

        {/* Visit Stats */}
        <View style={styles.statsContainer}>
          <VisitStatsCard />
        </View>

        {/* Settings Section */}
        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleText}>Settings</Text>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/profile/account-settings')}
          >
            <Ionicons name="settings" size={24} color="#8C1C13" style={styles.menuIcon} />
            <Text style={styles.menuText}>Account Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/profile/help-support')}
          >
            <Ionicons name="help-circle" size={24} color="#8C1C13" style={styles.menuIcon} />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/profile/feedback')}
          >
            <Ionicons name="chatbubble" size={24} color="#8C1C13" style={styles.menuIcon} />
            <Text style={styles.menuText}>Feedback</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Account Actions */}
        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleText}>Account</Text>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={[styles.menuItem, styles.logoutItem]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={24} color="#d32f2f" style={styles.menuIcon} />
            <Text style={[styles.menuText, styles.logoutText]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#E7E3E2',
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 15,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#8C1C13',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  menuContainer: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  logoutItem: {
    borderBottomWidth: 0,
  },
  logoutText: {
    color: '#d32f2f',
  },
});