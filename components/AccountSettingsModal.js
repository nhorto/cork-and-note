// components/AccountSettingsModal.js
import { Ionicons } from '@expo/vector-icons';
import { useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthContext } from '../app/_layout';
import { supabase } from '../lib/supabase';

const AccountSettingsModal = ({ visible, onClose, user }) => {
  const { signOut } = useContext(AuthContext);
  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [name, setName] = useState(user?.user_metadata?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Toggle sections
  const toggleSection = (section) => {
    if (activeSection === section) {
      setActiveSection(null);
    } else {
      setActiveSection(section);
      // Reset form fields when opening a section
      if (section === 'password') {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else if (section === 'delete') {
        setDeleteConfirmation('');
      }
    }
  };

  // Update profile (name)
  const updateProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.updateUser({
        data: { name: name.trim() }
      });

      if (error) throw error;

      Alert.alert('Success', 'Your profile has been updated successfully');
      setActiveSection(null);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Update email
  const updateEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.auth.updateUser({
        email: email.trim()
      });

      if (error) throw error;

      Alert.alert(
        'Verification Required',
        'A confirmation email has been sent to your new email address. Please check your inbox and follow the instructions to complete the email change.'
      );
      setActiveSection(null);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  // Update password
  const updatePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }
    
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      
      // First verify the current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (signInError) {
        Alert.alert('Error', 'Current password is incorrect');
        setLoading(false);
        return;
      }

      // Then update the password
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      Alert.alert('Success', 'Your password has been updated successfully');
      setActiveSection(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  // Delete account
  const deleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      Alert.alert('Error', 'Please type DELETE to confirm account deletion');
      return;
    }

    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Delete user's data from database tables
              const { error: dataError } = await supabase.rpc('delete_user_data');
              
              if (dataError) {
                console.error('Error deleting user data:', dataError);
                // Continue with account deletion even if data deletion fails
              }
              
              // Delete the user account
              const { error } = await supabase.auth.admin.deleteUser(user.id);
              
              if (error) throw error;
              
              Alert.alert('Account Deleted', 'Your account has been successfully deleted');
              await signOut();
              onClose();
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to delete account');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account Settings</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardAvoid}
        >
          <ScrollView style={styles.content}>
            {/* Update Name */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('name')}
              >
                <View style={styles.sectionTitle}>
                  <Ionicons name="person" size={22} color="#8C1C13" style={styles.sectionIcon} />
                  <Text style={styles.sectionTitleText}>Update Name</Text>
                </View>
                <Ionicons
                  name={activeSection === 'name' ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
              
              {activeSection === 'name' && (
                <View style={styles.sectionContent}>
                  <Text style={styles.label}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="Enter your name"
                  />
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={updateProfile}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>Update Name</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Update Email */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('email')}
              >
                <View style={styles.sectionTitle}>
                  <Ionicons name="mail" size={22} color="#8C1C13" style={styles.sectionIcon} />
                  <Text style={styles.sectionTitleText}>Update Email</Text>
                </View>
                <Ionicons
                  name={activeSection === 'email' ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
              
              {activeSection === 'email' && (
                <View style={styles.sectionContent}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter your email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <Text style={styles.noteText}>
                    You'll need to verify your new email address before the change takes effect.
                  </Text>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={updateEmail}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>Update Email</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Change Password */}
            <View style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('password')}
              >
                <View style={styles.sectionTitle}>
                  <Ionicons name="lock-closed" size={22} color="#8C1C13" style={styles.sectionIcon} />
                  <Text style={styles.sectionTitleText}>Change Password</Text>
                </View>
                <Ionicons
                  name={activeSection === 'password' ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
              
              {activeSection === 'password' && (
                <View style={styles.sectionContent}>
                  <Text style={styles.label}>Current Password</Text>
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    secureTextEntry
                  />
                  
                  <Text style={styles.label}>New Password</Text>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    secureTextEntry
                  />
                  
                  <Text style={styles.label}>Confirm New Password</Text>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm new password"
                    secureTextEntry
                  />
                  
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={updatePassword}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>Update Password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Delete Account */}
            <View style={[styles.section, styles.dangerSection]}>
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection('delete')}
              >
                <View style={styles.sectionTitle}>
                  <Ionicons name="trash" size={22} color="#FF3B30" style={styles.sectionIcon} />
                  <Text style={[styles.sectionTitleText, styles.dangerText]}>Delete Account</Text>
                </View>
                <Ionicons
                  name={activeSection === 'delete' ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
              
              {activeSection === 'delete' && (
                <View style={styles.sectionContent}>
                  <Text style={styles.warningText}>
                    Warning: This action cannot be undone. All your data, including your profile, visits, and wine logs will be permanently deleted.
                  </Text>
                  
                  <Text style={styles.label}>Type DELETE to confirm</Text>
                  <TextInput
                    style={[styles.input, styles.dangerInput]}
                    value={deleteConfirmation}
                    onChangeText={setDeleteConfirmation}
                    placeholder="Type DELETE here"
                  />
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.dangerButton]}
                    onPress={deleteAccount}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionButtonText}>Delete Account</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  closeButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dangerSection: {
    borderColor: '#FFCCCC',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 12,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3E3E3E',
  },
  dangerText: {
    color: '#FF3B30',
  },
  sectionContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  dangerInput: {
    borderColor: '#FFCCCC',
  },
  noteText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 16,
  },
  warningText: {
    fontSize: 14,
    color: '#FF3B30',
    marginBottom: 16,
    lineHeight: 20,
  },
  actionButton: {
    backgroundColor: '#8C1C13',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default AccountSettingsModal;