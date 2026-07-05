// components/FeedbackModal.js
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useContext, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import ScreenHeader from '../../components/ScreenHeader';
import { supabase } from '../../lib/supabase';
import theme from '../../styles/theme';
import { AuthContext } from '../_layout';

const { colors } = theme;

export default function FeedbackScreen() {
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
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={36}
              color={star <= rating ? colors.gold.rich : colors.neutral.stone}
              style={styles.starIcon}
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
                <Ionicons name="chatbubble" size={22} color={colors.primary.burgundy} style={styles.sectionIcon} />
                <Text style={styles.sectionTitleText}>Share feedback</Text>
              </View>
              <Ionicons
                name={activeSection === 'feedback' ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.neutral.pewter}
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
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={submitFeedback}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.neutral.cream} />
                  ) : (
                    <Text style={styles.actionButtonText}>Submit feedback</Text>
                  )}
                </TouchableOpacity>
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
                <Ionicons name="bug" size={22} color={colors.primary.burgundy} style={styles.sectionIcon} />
                <Text style={styles.sectionTitleText}>Report a bug</Text>
              </View>
              <Ionicons
                name={activeSection === 'bug' ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.neutral.pewter}
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
                  placeholderTextColor={colors.neutral.silver}
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
                  placeholderTextColor={colors.neutral.silver}
                />
                
                <Text style={styles.label}>Device</Text>
                <TextInput
                  style={styles.input}
                  value={bugDevice}
                  onChangeText={setBugDevice}
                  placeholder="What device are you using? (e.g., iPhone 13, Samsung Galaxy S21)"
                  placeholderTextColor={colors.neutral.silver}
                />
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={reportBug}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.neutral.cream} />
                  ) : (
                    <Text style={styles.actionButtonText}>Submit bug report</Text>
                  )}
                </TouchableOpacity>
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
                <Ionicons name="mail" size={22} color={colors.primary.burgundy} style={styles.sectionIcon} />
                <Text style={styles.sectionTitleText}>Contact support</Text>
              </View>
              <Ionicons
                name={activeSection === 'contact' ? 'chevron-up' : 'chevron-down'}
                size={22}
                color={colors.neutral.pewter}
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
                  placeholderTextColor={colors.neutral.silver}
                />
                
                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  value={contactSubject}
                  onChangeText={setContactSubject}
                  placeholder="What is your message about?"
                  placeholderTextColor={colors.neutral.silver}
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
                  placeholderTextColor={colors.neutral.silver}
                />
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={sendContactMessage}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.neutral.cream} />
                  ) : (
                    <Text style={styles.actionButtonText}>Send message</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* "Rate Cork & Note" section removed until the app has real App
              Store / Play Store IDs to link to. */}

          {/* Social Links */}
          <View style={styles.socialLinks}>
            <Text style={styles.socialTitle}>Connect with us</Text>
            <View style={styles.socialButtons}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://instagram.com/corkandnote')}
              >
                <Ionicons name="logo-instagram" size={24} color={colors.neutral.cream} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://facebook.com/corkandnote')}
              >
                <Ionicons name="logo-facebook" size={24} color={colors.neutral.cream} />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://twitter.com/corkandnote')}
              >
                <Ionicons name="logo-twitter" size={24} color={colors.neutral.cream} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.emailContact}>
              Email: support@corkandnote.com
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
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
    backgroundColor: colors.neutral.parchment,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.neutral.stone,
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
    color: colors.neutral.charcoal,
  },
  sectionContent: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.linen,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: colors.neutral.pewter,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.stone,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    backgroundColor: colors.neutral.cream,
    marginBottom: 16,
    color: colors.neutral.charcoal,
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
    borderColor: colors.neutral.stone,
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.neutral.cream,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary.burgundy,
  },
  segmentButtonText: {
    fontSize: 14,
    color: colors.neutral.pewter,
  },
  segmentButtonTextActive: {
    color: colors.neutral.cream,
    fontWeight: '500',
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  starIcon: {
    margin: 4,
  },
  actionButton: {
    backgroundColor: colors.primary.burgundy,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.neutral.cream,
    fontSize: 16,
    fontWeight: '500',
  },
  socialLinks: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  socialTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral.charcoal,
    marginBottom: 16,
  },
  socialButtons: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  socialButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary.burgundy,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  emailContact: {
    fontSize: 14,
    color: colors.neutral.pewter,
  }
});