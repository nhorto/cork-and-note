// app/profile/privacy-policy.js
import LegalDocScreen from '../../components/LegalDocScreen';
import { PRIVACY_POLICY } from '../../lib/legalContent';

export default function PrivacyPolicyScreen() {
  return <LegalDocScreen doc={PRIVACY_POLICY} />;
}
