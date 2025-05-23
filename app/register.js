// app/register.js
import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
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
import { AuthContext } from './_layout';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useContext(AuthContext);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
      { text: 'At least 8 characters', met: password.length >= 8 },
      { text: 'One uppercase letter', met: /[A-Z]/.test(password) },
      { text: 'One lowercase letter', met: /[a-z]/.test(password) },
      { text: 'One number', met: /\d/.test(password) },
    ];
    
    return requirements;
  };

  const handleRegister = async () => {
    // Basic validation
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    // Password validation
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      Alert.alert(
        'Password Requirements Not Met', 
        `Your password must have:\n• ${passwordValidation.errors.join('\n• ')}`
      );
      return;
    }

    setIsLoading(true);

    try {
      const { error, data } = await signUp(email, password, name);
      
      if (error) {
        if (error.message.includes('User already registered')) {
          Alert.alert(
            'Account Already Exists', 
            'An account with this email already exists. Would you like to sign in instead?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign In', onPress: () => router.replace('/login') }
            ]
          );
        } else {
          Alert.alert('Error', error.message);
        }
      } else {
        // Check if user is immediately signed in (no email confirmation)
        if (data.session && data.user) {
          // Navigation will be handled by the AuthContext and index.js
          setTimeout(() => {
            router.replace('/(tabs)/map');
          }, 100);
        } else {
          // If for some reason they need to confirm email or sign in manually
          Alert.alert(
            'Account Created!', 
            'Your account has been successfully created. You can now sign in.',
            [
              { text: 'OK', onPress: () => router.replace('/login') }
            ]
          );
        }
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const passwordRequirements = getPasswordRequirements();
  const showRequirements = password.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join Cork & Note to track your wine adventures</Text>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Ionicons name="person" size={20} color="#8C1C13" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail" size={20} color="#8C1C13" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#8C1C13" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.visibilityIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Ionicons 
                name={showPassword ? "eye-off" : "eye"} 
                size={20} 
                color="#8C1C13" 
              />
            </TouchableOpacity>
          </View>

          {/* Password Requirements Display */}
          {showRequirements && (
            <View style={styles.passwordRequirements}>
              <Text style={styles.requirementsTitle}>Password Requirements:</Text>
              {passwordRequirements.map((req, index) => (
                <View key={index} style={styles.requirementRow}>
                  <Ionicons 
                    name={req.met ? "checkmark-circle" : "ellipse-outline"} 
                    size={16} 
                    color={req.met ? "#4CAF50" : "#ccc"} 
                  />
                  <Text style={[
                    styles.requirementText, 
                    req.met ? styles.requirementMet : styles.requirementNotMet
                  ]}>
                    {req.text}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#8C1C13" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
            />
          </View>

          <TouchableOpacity 
            style={styles.registerButton} 
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialButtonsContainer}>
            <TouchableOpacity style={[styles.socialButton, styles.googleButton]}>
              <Ionicons name="logo-google" size={20} color="#000" />
              <Text style={styles.socialButtonText}>Google</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.socialButton, styles.appleButton]}>
              <Ionicons name="logo-apple" size={20} color="#fff" />
              <Text style={styles.socialButtonText}>Apple</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <Link href="/login" asChild>
            <TouchableOpacity>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2', // same as login screen
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3E3E3E',
    marginBottom: 8,
    marginTop: 40,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#3E3E3E',
    textAlign: 'center',
    marginBottom: 30,
  },
  formContainer: {
    width: '100%',
    marginBottom: 30,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
    backgroundColor: '#f9f9f9',
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
  visibilityIcon: {
    padding: 4,
  },
  passwordRequirements: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: 8,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementText: {
    fontSize: 13,
    marginLeft: 8,
  },
  requirementMet: {
    color: '#4CAF50',
  },
  requirementNotMet: {
    color: '#666',
  },
  registerButton: {
    backgroundColor: '#8C1C13', // deep red
    borderRadius: 8,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  registerButtonText: {
    color: '#b08442', // gold text
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: '#3E3E3E',
  },
  dividerText: {
    paddingHorizontal: 10,
    color: '#3E3E3E',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 8,
    width: '48%',
  },
  googleButton: {
    backgroundColor: '#ffff',
  },
  appleButton: {
    backgroundColor: '#000',
  },
  socialButtonText: {
    color: '#3E3E3E',
    marginLeft: 8,
    fontWeight: '500',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#3E3E3E',
  },
  loginLink: {
    fontSize: 14,
    color: '#8C1C13',
    fontWeight: 'bold',
  },
});