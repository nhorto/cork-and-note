// app/profile/change-password.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { AuthContext } from '../_layout';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validation function
  const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    
    const errors = [];
    
    if (password.length < minLength) {
      errors.push(`at least ${minLength} characters`);
    }
    if (!hasUpperCase) {
      errors.push('one uppercase letter');
    }
    if (!hasLowerCase) {
      errors.push('one lowercase letter');
    }
    if (!hasNumbers) {
      errors.push('one number');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  };

  // Get password requirements status for display
  const getPasswordRequirements = () => {
    const requirements = [
      { text: 'At least 8 characters', met: newPassword.length >= 8 },
      { text: 'One uppercase letter', met: /[A-Z]/.test(newPassword) },
      { text: 'One lowercase letter', met: /[a-z]/.test(newPassword) },
      { text: 'One number', met: /\d/.test(newPassword) },
    ];
    
    return requirements;
  };

  const handleChangePassword = async () => {
    // Basic validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return;
    }

    // Password validation
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      Alert.alert(
        'Password Requirements Not Met', 
        `Your new password must have:\n• ${passwordValidation.errors.join('\n• ')}`
      );
      return;
    }

    setIsLoading(true);

    try {
      // First verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setIsLoading(false);
        Alert.alert('Error', 'Current password is incorrect');
        return;
      }

      // Update password using Supabase Auth
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        setIsLoading(false);
        Alert.alert('Error', updateError.message || 'Failed to update password');
        return;
      }

      setIsLoading(false);
      Alert.alert(
        'Success',
        'Your password has been updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              // Clear form and go back
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              router.back();
            }
          }
        ]
      );
    } catch (error) {
      setIsLoading(false);
      console.error('Change password error:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    }
  };

  const passwordRequirements = getPasswordRequirements();

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#8C1C13" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.formContainer}>
          {/* Current Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Current Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter your current password"
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <Ionicons
                  name={showCurrentPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#8C1C13"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter your new password"
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#8C1C13"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Password Requirements */}
          {newPassword.length > 0 && (
            <View style={styles.requirementsContainer}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              {passwordRequirements.map((req, index) => (
                <View key={index} style={styles.requirementRow}>
                  <Ionicons
                    name={req.met ? 'checkmark-circle' : 'close-circle'}
                    size={16}
                    color={req.met ? '#4CAF50' : '#FF5722'}
                  />
                  <Text style={[
                    styles.requirementText,
                    { color: req.met ? '#4CAF50' : '#FF5722' }
                  ]}>
                    {req.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Confirm New Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm New Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm your new password"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color="#8C1C13"
                />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <Text style={styles.errorText}>Passwords do not match</Text>
            )}
          </View>

          {/* Update Button */}
          <TouchableOpacity
            style={[
              styles.updateButton,
              (!currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword) && styles.updateButtonDisabled
            ]}
            onPress={handleChangePassword}
            disabled={isLoading || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.updateButtonText}>Update Password</Text>
            )}
          </TouchableOpacity>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
            <Text style={styles.securityNoteText}>
              Your password is encrypted and secure. You will remain signed in on this device after changing your password.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    paddingTop: 50, // Account for status bar
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
    width: 34, // Same width as back button to center title
  },
  content: {
    flex: 1,
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  eyeButton: {
    padding: 15,
  },
  requirementsContainer: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 10,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  requirementText: {
    fontSize: 13,
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    color: '#FF5722',
    marginTop: 5,
  },
  updateButton: {
    backgroundColor: '#8C1C13',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  updateButtonDisabled: {
    backgroundColor: '#ccc',
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f8f0',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  securityNoteText: {
    fontSize: 13,
    color: '#4CAF50',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
});