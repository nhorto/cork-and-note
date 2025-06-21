// app/winery/[id].js - Updated with WineryActionButtons
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Linking,
  Modal,
  PixelRatio,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import PastVisitsSection from '../../components/PastVisitsSection';
import VisitLogForm from '../../components/VisitLogForm';
import WineryActionButtons from '../../components/WineryActionButtons';
import WineryStatusBadges from '../../components/WineryStatusBadges';
import wineries from '../../data/wineries_with_coordinates_and_id.json';
import { visitsService } from '../../lib/visits';
import { wineryStatusService } from '../../lib/wineryStatus';
import { AuthContext } from '../_layout';

export default function WineryDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  
  const winery = wineries.find((w) => w.id.toString() === id.toString());
  const [showLogForm, setShowLogForm] = useState(false);
  const [wineryStatus, setWineryStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Load winery status
  useEffect(() => {
    if (user && winery) {
      loadWineryStatus();
    } else {
      setStatusLoading(false);
    }
  }, [user, winery?.id]);

  // Function to load winery status
  const loadWineryStatus = async () => {
    try {
      setStatusLoading(true);
      const { success, status } = await wineryStatusService.getWineryStatus(winery.id);
      
      if (success) {
        setWineryStatus(status);
      }
    } catch (error) {
      console.error('Error loading winery status:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleSaveVisit = async (visitData) => {
    console.log('Saving visit:', visitData);
    
    try {
      // Save to database using the visits service
      const result = await visitsService.createVisit(visitData);
      
      if (result.success) {
        Alert.alert(
          'Visit Logged!', 
          `Your visit to ${winery.name} has been saved successfully.`,
          [
            { 
              text: 'OK', 
              onPress: () => {
                setShowLogForm(false);
                // Reload status to show the visited badge
                loadWineryStatus();
                // Reload the page to show the new visit
                navigation.setParams({ refresh: Date.now() });
              }
            }
          ]
        );
      } else {
        Alert.alert(
          'Error',
          `Failed to save your visit: ${result.error}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error saving visit:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred while saving your visit.',
        [{ text: 'OK' }]
      );
    }
  };

  // Handle exit from log form with confirmation
  const handleExitLogForm = () => {
    Alert.alert(
      'Discard Changes?',
      'Are you sure you want to exit? Any unsaved changes will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Exit', style: 'destructive', onPress: () => setShowLogForm(false) }
      ]
    );
  };

  // Handle status change from action buttons
  const handleStatusChange = (newStatus) => {
    setWineryStatus(prev => ({
      ...prev,
      ...newStatus
    }));
  };

  if (!winery) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text>Winery not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#3E3E3E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{winery.name}</Text>
      </View>
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.detailsContainer}>
          <Text style={styles.address}>{winery.address}</Text>

          {/* Status badges */}
          {user && wineryStatus && !statusLoading && (
            <WineryStatusBadges status={wineryStatus} />
          )}

          <View style={styles.divider} />

          {/* Action buttons */}
          {user && (
            <WineryActionButtons 
              winery={winery}
              initialStatus={wineryStatus}
              onStatusChange={handleStatusChange}
            />
          )}

          <View style={styles.actionButtons}>
            <TouchableOpacity 
              style={styles.actionButton} 
              onPress={() => setShowLogForm(true)}
            >
              <Ionicons name="wine" size={24} color="#8C1C13" />
              <Text style={styles.actionButtonText}>Log Your Visit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                const lat = winery.latitude;
                const lng = winery.longitude;
                const label = encodeURIComponent(winery.name || "Destination");
                
                if (Platform.OS === 'ios') {
                  const appleMapsUrl = `http://maps.apple.com/?ll=${lat},${lng}&q=${label}`;
                  Linking.openURL(appleMapsUrl).catch(() => {
                    const googleWebUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
                    Linking.openURL(googleWebUrl);
                  });
                } else {
                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                  Linking.openURL(googleMapsUrl).catch(() => {
                    const fallbackUrl = `https://maps.google.com/?q=${lat},${lng}`;
                    Linking.openURL(fallbackUrl);
                  });
                }
              }}
            >
              <Ionicons name="navigate" size={24} color="#8C1C13" />
              <Text style={styles.actionButtonText}>Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                Alert.alert('Website', `Opening ${winery.name} website...`);
              }}
            >
              <Ionicons name="globe" size={24} color="#8C1C13" />
              <Text style={styles.actionButtonText}>Website</Text>
            </TouchableOpacity>
          </View>
          
          {/* Additional winery info could go here */}
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>About {winery.name}</Text>
            <Text style={styles.infoText}>
              Visit this beautiful Virginia winery and experience their selection of wines.
            </Text>
          </View>
        </View>
        
        {/* Past visits section - only show if user is logged in */}
        {user && (
          <View style={styles.pastVisitsContainer}>
            <PastVisitsSection wineryId={id} />
          </View>
        )}
      </ScrollView>
      
      {/* Visit Log Form Modal */}
      <Modal
        visible={showLogForm}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleExitLogForm}
      >
        <SafeAreaProvider>
          <VisitLogForm
            winery={winery}
            onSave={handleSaveVisit}
            onCancel={handleExitLogForm}
          />
        </SafeAreaProvider>
      </Modal>
    </SafeAreaView>
  );
}

const { width, height } = Dimensions.get('window');
const isNarrowScreen = width < 375;
const isVeryNarrowScreen = width < 320;
const isWideScreen = width > 400;

const responsive = (size) =>
  Math.round(PixelRatio.roundToNearestPixel(size * (width / 375)));

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsive(16),
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    backgroundColor: '#E7E3E2',
  },
  backButton: {
    padding: responsive(8),
    marginRight: responsive(16),
  },
  headerTitle: {
    fontSize: responsive(20),
    fontWeight: 'bold',
    color: '#3E3E3E',
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: responsive(24),
    paddingHorizontal: isNarrowScreen ? responsive(8) : 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailsContainer: {
    padding: isVeryNarrowScreen ? responsive(12) : isNarrowScreen ? responsive(16) : responsive(20),
    backgroundColor: '#f9f9f9',
    borderRadius: responsive(8),
    margin: isVeryNarrowScreen ? responsive(8) : isNarrowScreen ? responsive(12) : responsive(16),
    borderWidth: 1,
    borderColor: '#ddd',
  },
  address: {
    fontSize: isNarrowScreen ? responsive(14) : responsive(16),
    color: '#3E3E3E',
    marginBottom: responsive(15),
    textAlign: 'center',
    lineHeight: responsive(20),
  },
  divider: {
    height: 1,
    backgroundColor: '#ccc',
    marginVertical: responsive(15),
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: responsive(20),
    paddingHorizontal: isNarrowScreen ? responsive(8) : 0,
  },
  actionButton: {
    alignItems: 'center',
    padding: responsive(10),
    minWidth: isNarrowScreen ? responsive(80) : responsive(100),
  },
  actionButtonText: {
    marginTop: responsive(8),
    fontSize: isNarrowScreen ? responsive(11) : responsive(12),
    color: '#8C1C13',
    fontWeight: '500',
    textAlign: 'center',
  },
  infoSection: {
    marginTop: responsive(20),
  },
  sectionTitle: {
    fontSize: isNarrowScreen ? responsive(16) : responsive(18),
    fontWeight: '600',
    color: '#3E3E3E',
    marginBottom: responsive(10),
  },
  infoText: {
    fontSize: isNarrowScreen ? responsive(14) : responsive(15),
    color: '#3E3E3E',
    lineHeight: isNarrowScreen ? responsive(20) : responsive(22),
  },
  pastVisitsContainer: {
    marginHorizontal: isVeryNarrowScreen ? responsive(8) : isNarrowScreen ? responsive(12) : responsive(16),
    marginBottom: responsive(16),
  },
});