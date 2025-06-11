// app/(tabs)/profile.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
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

// First, we'll add simple placeholder components for the modals
// These will be replaced with the full implementations once the basic screen works

const AccountSettingsModal = ({ visible, onClose, user }) => {
  if (!visible) return null;
  
  return (
    <View style={styles.modalPlaceholder}>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.modalPlaceholderText}>Account Settings Modal</Text>
      <Text>This will be replaced with the full modal component</Text>
    </View>
  );
};

const HelpSupportModal = ({ visible, onClose }) => {
  if (!visible) return null;
  
  return (
    <View style={styles.modalPlaceholder}>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.modalPlaceholderText}>Help & Support Modal</Text>
      <Text>This will be replaced with the full modal component</Text>
    </View>
  );
};

const FeedbackModal = ({ visible, onClose, user }) => {
  if (!visible) return null;
  
  return (
    <View style={styles.modalPlaceholder}>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Ionicons name="close" size={24} color="#333" />
      </TouchableOpacity>
      <Text style={styles.modalPlaceholderText}>Feedback & Contact Modal</Text>
      <Text>This will be replaced with the full modal component</Text>
    </View>
  );
};

export default function ProfileScreen() {
  // Make sure to destructure the AuthContext properly
  const { signOut, user } = useContext(AuthContext);
  const router = useRouter();
  
  // Modal states
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showHelpSupport, setShowHelpSupport] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

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
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
          </View>
          <Text style={styles.name}>{user?.user_metadata?.name || 'User'}</Text>
          <Text style={styles.email}>{user?.email || 'user@example.com'}</Text>
        </View>

        {/* Visit Stats Card - only show if user is logged in */}
        {user && (
          <View style={styles.statsContainer}>
            <VisitStatsCard />
          </View>
        )}

        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleText}>My Wine Journal</Text>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/wishlist')}
          >
            <Ionicons name="bookmark" size={24} color="#8C1C13" style={styles.menuIcon} />
            <Text style={styles.menuText}>Want to Visit</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => router.push('/wines')}  
          >
            <Ionicons name="wine" size={24} color="#8C1C13" style={styles.menuIcon} />
            <Text style={styles.menuText}>My Wines</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionTitle}>
          <Text style={styles.sectionTitleText}>Account</Text>
        </View>

        <View style={styles.menuContainer}>
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setShowAccountSettings(true)}
          >
            <Ionicons name="settings" size={24} color="#8C1C13" style={styles.menuIcon} />
            <Text style={styles.menuText}>Account Settings</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setShowHelpSupport(true)}
          >
            <Ionicons name="help-circle" size={24} color="#8C1C13" style={styles.menuIcon} />
            <Text style={styles.menuText}>Help & Support</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setShowFeedback(true)}
          >
            <Ionicons name="chatbubble-ellipses" size={24} color="#8C1C13" style={styles.menuIcon} />
            <Text style={styles.menuText}>Feedback & Contact</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out" size={20} color="#8C1C13" style={styles.logoutIcon} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Placeholder Modals - These will be replaced with the full components later */}
      <AccountSettingsModal 
        visible={showAccountSettings}
        onClose={() => setShowAccountSettings(false)}
        user={user}
      />

      <HelpSupportModal
        visible={showHelpSupport}
        onClose={() => setShowHelpSupport(false)}
      />

      <FeedbackModal
        visible={showFeedback}
        onClose={() => setShowFeedback(false)}
        user={user}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatarContainer: {
    marginBottom: 16,
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  email: {
    fontSize: 14,
    color: '#666',
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionTitle: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 10,
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3E3E3E',
  },
  menuContainer: {
    marginBottom: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
    marginBottom: 50,
    paddingVertical: 15,
  },
  logoutIcon: {
    marginRight: 8,
  },
  logoutText: {
    color: '#8C1C13',
    fontSize: 16,
    fontWeight: '500',
  },
  // Modal placeholder styles
  modalPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#E7E3E2',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalPlaceholderText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
  },
});