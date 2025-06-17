// components/HelpSupportModal.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const HelpSupportModal = () => {
  const router = useRouter();
  const [activeGuide, setActiveGuide] = useState(null);

  // Help guides data
  const guides = [
    {
      id: 'wine-statistics',
      title: 'Understanding Wine Statistics',
      icon: 'analytics',
      content: [
        {
          type: 'text',
          value: 'Your profile page shows statistics about your wine journey:'
        },
        {
          type: 'attributes',
          value: [
            {
              name: 'Wineries Visited',
              description: "The total number of unique wineries you've logged visits to"
            },
            {
              name: 'Total Visits',
              description: 'The number of winery visits you\'ve recorded'
            },
            {
              name: 'Wines Tasted',
              description: 'The total number of individual wines you\'ve logged'
            }
          ]
        },
        {
          type: 'text',
          value: "You'll also see your recent visits and wines, allowing you to quickly access your recent experiences."
        },
        {
          type: 'tip',
          value: 'Log all your winery visits to build a comprehensive wine tasting history and see your wine journey evolve over time.'
        }
      ]
    },
    {
      id: 'badges-wishlist',
      title: 'Badges & Wishlist',
      icon: 'bookmarks',
      content: [
        {
          type: 'text',
          value: 'Cork & Note offers features to organize your wine adventures:'
        },
        {
          type: 'attributes',
          value: [
            {
              name: 'Visited Badge',
              description: "Shows you've been to this winery (green checkmark)"
            },
            {
              name: 'Favorite',
              description: 'Mark wineries you especially enjoyed with the heart icon'
            },
            {
              name: 'Want to Visit',
              description: 'Add wineries to your wishlist to remember places you want to explore'
            }
          ]
        },
        {
          type: 'text',
          value: 'You can use the "Want to Visit" tab to view all wineries on your wishlist, making it easy to plan your next wine adventure.'
        },
        {
          type: 'tip',
          value: 'Use the map view to see wineries you\'ve visited and those on your wishlist, helping you discover new regions to explore.'
        }
      ]
    },
    {
      id: 'logging-visit',
      title: 'Logging Your First Visit',
      icon: 'wine',
      content: [
        {
          type: 'text',
          value: "Logging your winery visits is easy and helps you keep track of your wine tasting experiences. Here's how to get started:"
        },
        {
          type: 'steps',
          value: [
            'Navigate to any winery detail page through the Map or Wineries tab',
            'Tap the "Log Your Visit" button',
            'Enter the date of your visit',
            'Add wines you tasted during your visit',
            'Include notes and photos to remember your experience',
            'Tap "Save Visit" to complete'
          ]
        },
        {
          type: 'text',
          value: 'You can view all your past visits on the winery detail page or by going to the Wines tab to see all wines you\'ve tasted.'
        },
        {
          type: 'tip',
          value: "Take photos of wines and winery views while you're there to enhance your tasting journal!"
        }
      ]
    },
    {
      id: 'wine-ratings',
      title: 'Understanding Wine Ratings',
      icon: 'star',
      content: [
        {
          type: 'text',
          value: 'Cork & Note uses a 5-point rating system for wines, with several characteristics to help you remember what you liked about each wine:'
        },
        {
          type: 'attributes',
          value: [
            {
              name: 'Overall Rating',
              description: 'Your general impression of the wine from 1-5 stars'
            },
            {
              name: 'Sweetness',
              description: 'From bone dry (1) to very sweet (5)'
            },
            {
              name: 'Tannins',
              description: 'The drying, astringent sensation (primarily in red wines) from soft (1) to highly tannic (5)'
            },
            {
              name: 'Acidity',
              description: 'The tart or sour sensation from low (1) to high (5)'
            },
            {
              name: 'Body',
              description: 'The weight and fullness of the wine in your mouth from light (1) to full-bodied (5)'
            },
            {
              name: 'Alcohol',
              description: 'The perception of alcohol content from low (1) to high (5)'
            }
          ]
        },
        {
          type: 'text',
          value: 'These ratings help you identify patterns in wines you enjoy and make better selections in the future.'
        }
      ]
    },
    {
      id: 'flavor-notes',
      title: 'Using Flavor Notes',
      icon: 'leaf',
      content: [
        {
          type: 'text',
          value: 'Flavor notes help you identify and remember the tastes and aromas in each wine. Our flavor note selector makes this easy:'
        },
        {
          type: 'steps',
          value: [
            'When adding or editing a wine, scroll to the Flavor Notes section',
            'Browse categories like Fruit, Floral & Herbal, Spice & Wood, etc.',
            'Tap on the flavors you detect in the wine',
            'Use the search function to quickly find specific notes',
            'Add custom notes for unique flavors not in our list'
          ]
        },
        {
          type: 'text',
          value: 'Flavor notes are organized into categories to make selection easier:'
        },
        {
          type: 'bullets',
          value: [
            'Fruit: Apple, cherry, citrus, berry notes, etc.',
            'Floral & Herbal: Rose, lavender, thyme, mint, etc.',
            'Spice & Wood: Vanilla, cinnamon, oak, cedar, etc.',
            'Earth & Mineral: Wet stone, mushroom, graphite, etc.',
            'Other: Honey, chocolate, coffee, bread, etc.'
          ]
        },
        {
          type: 'tip',
          value: "Don't worry about getting it \"right\" - your perception is what matters! Start with broad categories and get more specific as you gain experience."
        }
      ]
    }
  ];

  // Back to main menu - FIXED: Now properly handles navigation
  const handleBack = () => {
    if (activeGuide) {
      // If viewing a guide, go back to the help menu
      setActiveGuide(null);
    } else {
      // If on main help menu, go back to profile
      router.back();
    }
  };

  // Render guide content based on type
  const renderGuideContent = (item) => {
    switch (item.type) {
      case 'text':
        return <Text style={styles.contentText}>{item.value}</Text>;

      case 'steps':
        return (
          <View style={styles.stepsList}>
            {item.value.map((step, index) => (
              <View key={index} style={styles.stepItem}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        );

      case 'bullets':
        return (
          <View style={styles.bulletList}>
            {item.value.map((bullet, index) => (
              <View key={index} style={styles.bulletItem}>
                <Text style={styles.bulletPoint}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </View>
        );

      case 'attributes':
        return (
          <View style={styles.attributesList}>
            {item.value.map((attr, index) => (
              <View key={index} style={styles.attributeItem}>
                <Text style={styles.attributeName}>{attr.name}</Text>
                <Text style={styles.attributeDescription}>{attr.description}</Text>
              </View>
            ))}
          </View>
        );

      case 'tip':
        return (
          <View style={styles.tipContainer}>
            <Ionicons name="bulb" size={24} color="#B08442" style={styles.tipIcon} />
            <Text style={styles.tipText}>{item.value}</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Custom Header - FIXED: Proper centering without save button */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={24} color="#8C1C13" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        {/* Empty view to balance the layout and center the title */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {activeGuide ? (
          // Display selected guide content
          <View style={styles.guideContent}>
            {guides.find(g => g.id === activeGuide)?.content.map((item, index) => (
              <View key={index} style={styles.contentItem}>
                {renderGuideContent(item)}
              </View>
            ))}
          </View>
        ) : (
          // Display guide menu
          <View style={styles.guidesMenu}>
            {guides.map((guide) => (
              <TouchableOpacity
                key={guide.id}
                style={styles.guideItem}
                onPress={() => setActiveGuide(guide.id)}
              >
                <View style={styles.guideIcon}>
                  <Ionicons name={guide.icon} size={24} color="#8C1C13" />
                </View>
                <View style={styles.guideInfo}>
                  <Text style={styles.guideTitle}>{guide.title}</Text>
                  <Text style={styles.guideSubtitle}>Learn more</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            ))}

            {/* App version info */}
            <View style={styles.versionInfo}>
              <Text style={styles.versionText}>Cork & Note v1.0.0</Text>
              <Text style={styles.copyrightText}>© 2025 Cork & Note. All rights reserved.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E7E3E2',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3E3E3E',
    flex: 1,
    textAlign: 'center',
  },
  // FIXED: Added spacer to balance the layout and center the title
  headerSpacer: {
    width: 40, // Same width as back button to maintain balance
  },
  content: {
    flex: 1,
  },
  guidesMenu: {
    padding: 16,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  guideIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(140, 28, 19, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  guideInfo: {
    flex: 1,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3E3E3E',
    marginBottom: 4,
  },
  guideSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  guideContent: {
    padding: 16,
  },
  contentItem: {
    marginBottom: 20,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#3E3E3E',
    marginBottom: 12,
  },
  stepsList: {
    marginVertical: 12,
  },
  stepItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8C1C13',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#3E3E3E',
  },
  bulletList: {
    marginVertical: 12,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 18,
    color: '#8C1C13',
    marginRight: 10,
    marginTop: -2,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#3E3E3E',
  },
  attributesList: {
    marginVertical: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  attributeItem: {
    marginBottom: 12,
  },
  attributeName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8C1C13',
    marginBottom: 4,
  },
  attributeDescription: {
    fontSize: 14,
    color: '#3E3E3E',
    lineHeight: 20,
  },
  tipContainer: {
    backgroundColor: 'rgba(176, 132, 66, 0.1)',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    borderLeftColor: '#B08442',
  },
  tipIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  tipText: {
    flex: 1,
    fontSize: 15,
    fontStyle: 'italic',
    color: '#3E3E3E',
    lineHeight: 22,
  },
  versionInfo: {
    marginTop: 30,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: '#999',
  },
});

export default HelpSupportModal;