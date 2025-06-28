// this is me just getting reps at typing out the code and adding alot of comments 
//  explaining what is going on

// app/_layout.js

/*
the _layout file is one of the first files that gets run in the app. In this file you 
put things that are used throughout the app. like the AuthContext. you also add 
auth in this and see if the user already has a session
and set up a listener for auth changes and other things like this
*/

// IMPORTS
import * as SplashScreen from 'expo-splash-screen';
import { createContext, useEffect, useState } from 'react';
import 'react-native-reanimated';

// Prevent the splahs screen from auto-hiding
SplashScreen.preventAutoHideAsync();
/*
This give you control over when to hide the splash screen. this can be useful when you need
to control when the splashscreen dispeaers. by default, this will disapear whenever the 
JS bundle is do loading. but there is a need sometimes to still show the splash screen to 
wait for other things to load. like if you need to wait for auth or founts, or signing in
or signing out and things like that. this allow you to control when to not show the splash
screen until everything is ready to be displayed
*/

// Auth context
export const AuthContext = createContext({
    signIn: () => {},
    signOut: () => {},
    signup: () => {},
    resetPassword: () => {}, 
    changePassword:() => {},
    user: null,
    isLoading: true,
    ssession: null,
    isAuthenticated: false,
});

/*
this is to set up the AuthContext that can be accessed througout the app. 
i am creating empty states to be filled for this context which will later be filled in.

*/




// app/(tabs)/profile.js - FIXED VERSION with race condition handling
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext } from 'react';
import {
    ActivityIndicator,
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
  const { signOut, user, isLoading } = useContext(AuthContext);
  const router = useRouter();
  
  // Add state to track if we've initialized user-dependent data
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Wait for auth to be ready before loading user data
  useEffect(() => {
    if (!isLoading && user) {
      // Auth is ready and we have a user - safe to load user data
      console.log('✅ Auth ready, loading user profile data...');
      loadUserData();
    } else if (!isLoading && !user) {
      // Auth is ready but no user - this shouldn't happen on profile screen
      // but handle it gracefully
      setIsDataLoaded(true);
    }
  }, [isLoading, user]);

  const loadUserData = async () => {
    try {
      // This is where you'd load any additional user-specific data
      // For now, we'll just mark as loaded since user data comes from auth context
      
      // Example: if you had additional profile data to fetch:
      // const profileData = await profileService.getUserProfile();
      // setProfileData(profileData);
      
      setIsDataLoaded(true);
      console.log('✅ Profile data loaded');
    } catch (error) {
      console.error('Error loading profile data:', error);
      setIsDataLoaded(true); // Still mark as loaded to show the UI
    }
  };

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

  // Show loading indicator while auth is initializing OR while loading user data
  if (isLoading || !isDataLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8C1C13" />
        <Text style={styles.loadingText}>
          {isLoading ? 'Initializing...' : 'Loading profile...'}
        </Text>
      </View>
    );
  }

  // If no user after loading is complete, show error state
  if (!user) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#d32f2f" />
        <Text style={styles.errorText}>Unable to load profile</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.replace('/login')}>
          <Text style={styles.retryText}>Return to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
          {/* Now safely access user data - no more race condition! */}
          <Text style={styles.name}>
            {user?.user_metadata?.name || user?.email?.split('@')[0] || 'Wine Enthusiast'}
          </Text>
          <Text style={styles.email}>
            {user?.email || 'user@example.com'}
          </Text>
        </View>

        {/* Visit Stats - This component should also implement the same pattern */}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E7E3E2',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E7E3E2',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#d32f2f',
    marginVertical: 10,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#8C1C13',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
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