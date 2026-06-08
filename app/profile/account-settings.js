// app/profile/account-settings.js
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { AuthContext } from '../_layout';

export default function AccountSettingsScreen() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  
  // Local state for settings
  const [notifications, setNotifications] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationPermissionStatus, setLocationPermissionStatus] = useState(null);

  // Check current location permission status on component mount
  useEffect(() => {
    checkLocationPermission();
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
              'Disable Location Services',
              'To completely disable location access, please go to your device Settings > Privacy & Security > Location Services and turn off location access for this app.',
              [
                { text: 'OK', style: 'default' }
              ]
            );
        }
      } catch (error) {
        console.error('Error requesting location permission:', error);
        Alert.alert('Error', 'Unable to request location permission.');
      }
    } else {
      // User wants to disable location - show info about how to disable in settings
      setLocationEnabled(false);
      Alert.alert(
        'Disable Location Services',
        'To completely disable location access, please go to your device Settings > Privacy & Security > Location Services and turn off location access for this app.',
        [
          { text: 'OK', style: 'default' }
        ]
      );
    }
  };

  const handleNotificationsToggle = (value) => {
    setNotifications(value);
    // You can add actual notification preference saving logic here
    if (value) {
      Alert.alert('Notifications Enabled', 'You will receive notifications about new features and updates.');
    } else {
      Alert.alert('Notifications Disabled', 'You will not receive notifications from the app.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#8C1C13" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Privacy & Permissions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & Permissions</Text>
          
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Push Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive notifications about new features and updates
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: '#ccc', true: '#8C1C13' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Location Services</Text>
              <Text style={styles.settingDescription}>
                Allow location access to find nearby wineries and show your location on the map
              </Text>
              {locationPermissionStatus && (
                <Text style={[
                  styles.permissionStatus, 
                  { color: locationPermissionStatus === 'granted' ? '#4CAF50' : '#FF5722' }
                ]}>
                  Status: {locationPermissionStatus === 'granted' ? 'Enabled' : 'Disabled'}
                </Text>
              )}
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={handleLocationToggle}
              trackColor={{ false: '#ccc', true: '#8C1C13' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Account Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => router.push('/profile/change-password')}
          >
            <Ionicons name="key" size={20} color="#8C1C13" />
            <Text style={styles.actionButtonText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.dangerButton]}
            onPress={() => {
              Alert.alert(
                'Delete Account',
                'This action cannot be undone. Are you sure you want to delete your account and all associated data?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Delete', 
                    style: 'destructive',
                    onPress: () => {
                      // Implement account deletion logic here
                      Alert.alert('Feature Coming Soon', 'Account deletion will be available in a future update.');
                    }
                  }
                ]
              );
            }}
          >
            <Ionicons name="trash" size={20} color="#d32f2f" />
            <Text style={[styles.actionButtonText, styles.dangerText]}>Delete Account</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 50,
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 34,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 10,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
    color: '#333',
    marginBottom: 5,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
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
    borderBottomColor: '#f0f0f0',
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 15,
  },
  dangerButton: {
    borderBottomWidth: 0,
  },
  dangerText: {
    color: '#d32f2f',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    width: 60,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  infoNote: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 10,
    lineHeight: 16,
  },
});