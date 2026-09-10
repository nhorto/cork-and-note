// components/FeedbackModal.js
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useContext, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Button from '../../components/Button';
import ScreenHeader from '../../components/ScreenHeader';
import { supabase } from '../../lib/supabase';
import { createThemedStyles } from '../../styles/ThemeProvider';
import { AuthContext } from '../_layout';


export default function FeedbackScreen() {
  const { colors, styles } = useScreenTheme();

  const { user } = useContext(AuthContext);

  const [activeSection, setActiveSection] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [feedbackType, setFeedbackType] = useState('feature');
  const [feedbackText, setFeedbackText] = useState('');
  const [rating, setRating] = useState(0);
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [bugDescription, setBugDescription] = useState('');
  const [bugSteps, setBugSteps] = useState('');
  const [bugDevice, setBugDevice] = useState(Platform.OS === 'ios' ? 'iPhone' : 'Android');

  // Toggle sections
  const toggleSection = (section) => {
    if (activeSection === section) {
      setActiveSection(null);
    } else {
      setActiveSection(section);
      
      // Reset form fields when opening a section
      if (section === 'feedback') {
        setFeedbackType('feature');
        setFeedbackText('');
        setRating(0);
      } else if (section === 'bug') {
        setBugDescription('');
        setBugSteps('');
        setBugDevice(Platform.OS === 'ios' ? 'iPhone' : 'Android');
      } else if (section === 'contact') {
        setContactEmail(user?.email || '');
        setContactSubject('');
        setContactMessage('');
      }
    }
  };

  // Submit feedback
  const submitFeedback = async () => {
    if (!feedbackText.trim()) {
      Alert.alert('Error', 'Please enter your feedback');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('feedback')
        .insert({
          user_id: user?.id || null,
          email: user?.email || null,
          feedback_type: feedbackType,
          message: feedbackText.trim(),
          rating: feedbackType === 'rating' ? rating : null
        });

      if (error) throw error;

      Alert.alert('Thank You!', 'Your feedback has been submitted successfully. We appreciate your input!');
      setActiveSection(null);
      setFeedbackText('');
      setRating(0);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  // Report bug
  const reportBug = async () => {
    if (!bugDescription.trim()) {
      Alert.alert('Error', 'Please describe the bug');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('bug_reports')
        .insert({
          user_id: user?.id || null,
          email: user?.email || null,
          description: bugDescription.trim(),
          steps_to_reproduce: bugSteps.trim(),
          device: bugDevice,
          platform: Platform.OS,
          version: Constants.expoConfig?.version ?? 'unknown'
        });

      if (error) throw error;

      Alert.alert('Bug Reported', 'Thank you for reporting this issue. Our team will investigate it.');
      setActiveSection(null);
      setBugDescription('');
      setBugSteps('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to report bug');
    } finally {
      setLoading(false);
    }
  };

  // Send contact message
  const sendContactMessage = async () => {
    if (!contactEmail.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!contactSubject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }

    if (!contactMessage.trim()) {
      Alert.alert('Error', 'Please enter your message');
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('contact_messages')
        .insert({
          user_id: user?.id || null,
          email: contactEmail.trim(),
          subject: contactSubject.trim(),
          message: contactMessage.trim()
        });

      if (error) throw error;

      Alert.alert('Message Sent', 'Your message has been sent. We\'ll get back to you as soon as possible.');
      setActiveSection(null);
      setContactSubject('');
      setContactMessage('');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  // Render star rating selector
  const renderRatingStars = () => {
    return (
      <View style={styles.ratingContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
            accessibilityRole="radio"
            accessibilityLabel={`Rate ${star} of 5`}
            accessibilityState={{ selected: star === rating }}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={36}
              color={star <= rating ? colors.accent.base : colors.neutral.border}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Feedback" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        <ScrollView style={styles.content}>
          {/* Feedback Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection('feedback')}
            >
              <View style={styles.sectionTitle}>
                <Ionicons name="chatbubble" size={22} color={colors.primary.ink} style={styles.sectionIcon} />
                <Text style={styles.sectionTitleText}>Share feedback</Text>
              </View>
              <Ionicons
                name={activeSection === 'feedback' ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.neutral.inkTertiary}
              />
            </TouchableOpacity>
            
            {activeSection === 'feedback' && (
              <View style={styles.sectionContent}>
                <Text style={styles.label}>Feedback type</Text>
                <View style={styles.segmentedControl}>
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      feedbackType === 'feature' && styles.segmentButtonActive
                    ]}
                    onPress={() => setFeedbackType('feature')}
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        feedbackType === 'feature' && styles.segmentButtonTextActive
                      ]}
                    >
                      Feature request
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      feedbackType === 'improvement' && styles.segmentButtonActive
                    ]}
                    onPress={() => setFeedbackType('improvement')}
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        feedbackType === 'improvement' && styles.segmentButtonTextActive
                      ]}
                    >
                      Improvement
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.segmentButton,
                      feedbackType === 'rating' && styles.segmentButtonActive
                    ]}
                    onPress={() => setFeedbackType('rating')}
                  >
                    <Text
                      style={[
                        styles.segmentButtonText,
                        feedbackType === 'rating' && styles.segmentButtonTextActive
                      ]}
                    >
                      Rating
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {feedbackType === 'rating' && renderRatingStars()}
                
                <Text style={styles.label}>Your feedback</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  placeholder={
                    feedbackType === 'feature' ? "What feature would you like to see?" :
                    feedbackType === 'improvement' ? "What would you like us to improve?" :
                    "Tell us why you gave this rating"
                  }
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                />
                
                <Button
                  title="Submit feedback"
                  onPress={submitFeedback}
                  loading={loading}
                />
              </View>
            )}
          </View>

          {/* Report Bug Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection('bug')}
            >
              <View style={styles.sectionTitle}>
                <Ionicons name="bug" size={22} color={colors.primary.ink} style={styles.sectionIcon} />
                <Text style={styles.sectionTitleText}>Report a bug</Text>
              </View>
              <Ionicons
                name={activeSection === 'bug' ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.neutral.inkTertiary}
              />
            </TouchableOpacity>
            
            {activeSection === 'bug' && (
              <View style={styles.sectionContent}>
                <Text style={styles.label}>Bug description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bugDescription}
                  onChangeText={setBugDescription}
                  placeholder="Please describe what happened"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  placeholderTextColor={colors.neutral.placeholder}
                />
                
                <Text style={styles.label}>Steps to reproduce</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bugSteps}
                  onChangeText={setBugSteps}
                  placeholder="What were you doing when the bug occurred?"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  placeholderTextColor={colors.neutral.placeholder}
                />
                
                <Text style={styles.label}>Device</Text>
                <TextInput
                  style={styles.input}
                  value={bugDevice}
                  onChangeText={setBugDevice}
                  placeholder="What device are you using? (e.g., iPhone 13, Samsung Galaxy S21)"
                  placeholderTextColor={colors.neutral.placeholder}
                />
                
                <Button
                  title="Submit bug report"
                  onPress={reportBug}
                  loading={loading}
                />
              </View>
            )}
          </View>

          {/* Contact Support Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => toggleSection('contact')}
            >
              <View style={styles.sectionTitle}>
                <Ionicons name="mail" size={22} color={colors.primary.ink} style={styles.sectionIcon} />
                <Text style={styles.sectionTitleText}>Contact support</Text>
              </View>
              <Ionicons
                name={activeSection === 'contact' ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.neutral.inkTertiary}
              />
            </TouchableOpacity>
            
            {activeSection === 'contact' && (
              <View style={styles.sectionContent}>
                <Text style={styles.label}>Your email</Text>
                <TextInput
                  style={styles.input}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  placeholder="Enter your email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor={colors.neutral.placeholder}
                />
                
                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  value={contactSubject}
                  onChangeText={setContactSubject}
                  placeholder="What is your message about?"
                  placeholderTextColor={colors.neutral.placeholder}
                />
                
                <Text style={styles.label}>Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={contactMessage}
                  onChangeText={setContactMessage}
                  placeholder="How can we help you?"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  placeholderTextColor={colors.neutral.placeholder}
                />
                
                <Button
                  title="Send message"
                  onPress={sendContactMessage}
                  loading={loading}
                />
              </View>
            )}
          </View>

          {/* "Rate Cork & Note" section removed until the app has real App
              Store / Play Store IDs to link to. */}

          {/* "Connect with us" (social links + support email) removed until
              the handles and support mailbox actually exist (#166). */}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};



const useScreenTheme = createThemedStyles((theme) => {
const { colors } = theme;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.bg,
  },
  keyboardAvoid: {
    flex: 1,
  },
  closeButton: {
    padding: 8,
    marginLeft: 'auto',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: colors.neutral.surface,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral.border,
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
    color: colors.neutral.ink,
  },
  sectionContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.divider,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: colors.neutral.inkTertiary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.neutral.bg,
    marginBottom: 16,
    color: colors.neutral.ink,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  segmentedControl: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.neutral.bg,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary.base,
  },
  segmentButtonText: {
    fontSize: 14,
    color: colors.neutral.inkTertiary,
  },
  segmentButtonTextActive: {
    color: colors.onPrimary,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  // 44pt touch target (§3.3); the margin lived on the icon and didn't extend it
  starButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
return { colors, styles };
});
