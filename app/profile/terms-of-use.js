// app/profile/terms-of-use.js
import LegalDocScreen from '../../components/LegalDocScreen';
import { TERMS_OF_USE } from '../../lib/legalContent';

export default function TermsOfUseScreen() {
  return <LegalDocScreen doc={TERMS_OF_USE} />;
}
