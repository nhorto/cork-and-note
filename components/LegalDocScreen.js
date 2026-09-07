// components/LegalDocScreen.js — renders a legal document (privacy policy /
// terms of use) from lib/legalContent.js (#162).
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import theme from '../styles/theme';
import ScreenHeader from './ScreenHeader';

const { colors } = theme;

export default function LegalDocScreen({ doc }) {
  return (
    <View style={styles.container}>
      <ScreenHeader title={doc.title} />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        <Text style={styles.updated}>Last updated: {doc.updated}</Text>

        {doc.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.paragraphs.map((paragraph, index) => (
              <Text key={index} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.cream,
  },
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 40,
  },
  updated: {
    fontSize: 13,
    color: colors.neutral.pewter,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  heading: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary.burgundy,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.neutral.charcoal,
    marginBottom: 10,
  },
});
