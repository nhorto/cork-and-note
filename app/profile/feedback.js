// components/FeedbackModal.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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
import { supabase } from '../../lib/supabase';
import { AuthContext } from '../_layout';

export default function FeedbackScreen() {
  const router = useRouter();
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
          version: '1.0.0' // App version
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

  // Rate the app (open app store)
  const rateApp = () => {
    const appStoreUrl = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/app/idXXXXXXXXXX' // Replace with actual App Store URL
      : 'https://play.google.com/store/apps/details?id=com.yourcompany.corkandnote'; // Replace with actual Play Store URL
    
    Linking.canOpenURL(appStoreUrl).then(supported => {
      if (supported) {
        Linking.openURL(appStoreUrl);
      } else {
        Alert.alert('Error', 'Could not open app store');
      }
    });
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
              color={star <= rating ? '#FFD700' : '#ccc'}
              style={styles.starIcon}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
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
        <Text style={styles.headerTitle}>Feedback</Text>
        <View style={styles.headerSpacer} />
      </View>

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
                <Ionicons name="chatbubble" size={22} color="#8C1C13" style={styles.sectionIcon} />
                <Text style={styles.sectionTitleText}>Share Feedback</Text>
              </View>
              <Ionicons
                name={activeSection === 'feedback' ? 'chevron-up' : 'chevron-down'}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
            
            {activeSection === 'feedback' && (
              <View style={styles.sectionContent}>
                <Text style={styles.label}>Feedback Type</Text>
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
                      Feature Request
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
                
                <Text style={styles.label}>Your Feedback</Text>
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
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Submit Feedback</Text>
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
                <Ionicons name="bug" size={22} color="#8C1C13" style={styles.sectionIcon} />
                <Text style={styles.sectionTitleText}>Report a Bug</Text>
              </View>
              <Ionicons
                name={activeSection === 'bug' ? 'chevron-up' : 'chevron-down'}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
            
            {activeSection === 'bug' && (
              <View style={styles.sectionContent}>
                <Text style={styles.label}>Bug Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bugDescription}
                  onChangeText={setBugDescription}
                  placeholder="Please describe what happened"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                
                <Text style={styles.label}>Steps to Reproduce</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={bugSteps}
                  onChangeText={setBugSteps}
                  placeholder="What were you doing when the bug occurred?"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                
                <Text style={styles.label}>Device</Text>
                <TextInput
                  style={styles.input}
                  value={bugDevice}
                  onChangeText={setBugDevice}
                  placeholder="What device are you using? (e.g., iPhone 13, Samsung Galaxy S21)"
                />
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={reportBug}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Submit Bug Report</Text>
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
                <Ionicons name="mail" size={22} color="#8C1C13" style={styles.sectionIcon} />
                <Text style={styles.sectionTitleText}>Contact Support</Text>
              </View>
              <Ionicons
                name={activeSection === 'contact' ? 'chevron-up' : 'chevron-down'}
                size={22}
                color="#666"
              />
            </TouchableOpacity>
            
            {activeSection === 'contact' && (
              <View style={styles.sectionContent}>
                <Text style={styles.label}>Your Email</Text>
                <TextInput
                  style={styles.input}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  placeholder="Enter your email address"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                
                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  value={contactSubject}
                  onChangeText={setContactSubject}
                  placeholder="What is your message about?"
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
                />
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={sendContactMessage}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>Send Message</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Rate App Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={rateApp}
            >
              <View style={styles.sectionTitle}>
                <Ionicons name="star" size={22} color="#8C1C13" style={styles.sectionIcon} />
                <Text style={styles.sectionTitleText}>Rate Cork & Note</Text>
              </View>
              <Ionicons name="open-outline" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Social Links */}
          <View style={styles.socialLinks}>
            <Text style={styles.socialTitle}>Connect With Us</Text>
            <View style={styles.socialButtons}>
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://instagram.com/corkandnote')}
              >
                <Ionicons name="logo-instagram" size={24} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://facebook.com/corkandnote')}
              >
                <Ionicons name="logo-facebook" size={24} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.socialButton}
                onPress={() => Linking.openURL('https://twitter.com/corkandnote')}
              >
                <Ionicons name="logo-twitter" size={24} color="#fff" />
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
    backgroundColor: '#E7E3E2',
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerSpacer: {
    width: 40, // Same width as back button to maintain balance
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  closeButton: {
    padding: 8,
    marginLeft: 'auto',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
    flex: 1,
    textAlign: 'center',
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
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  segmentedControl: {
    flexDirection: 'row',
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  segmentButtonActive: {
    backgroundColor: '#8C1C13',
  },
  segmentButtonText: {
    fontSize: 14,
    color: '#666',
  },
  segmentButtonTextActive: {
    color: '#fff',
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
    backgroundColor: '#8C1C13',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
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
    color: '#3E3E3E',
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
    backgroundColor: '#8C1C13',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  emailContact: {
    fontSize: 14,
    color: '#666',
  }
});