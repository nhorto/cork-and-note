// app/profile/privacy-policy.js
import { Platform } from 'react-native';
import LegalDocScreen from '../../components/LegalDocScreen';
import { legalDocsFor } from '../../lib/legalContent';

export default function PrivacyPolicyScreen() {
  // Platform-specific copy: billing sentences name the store this device
  // actually uses (Apple Account on iOS, Google Play on Android).
  return <LegalDocScreen doc={legalDocsFor(Platform.OS).privacyPolicy} />;
}
