// Reason/submit logic of ReportAiResponseModal (Google Play AI-content
// policy): submit stays disabled until a reason is picked, a successful
// submit files the report with the message + context and flips to the
// in-place confirmation, and a failed submit tells the user and stays on the
// form so they can retry.
//
// lib/aiReports pulls in lib/supabase (native AsyncStorage under the hood) —
// stubbed, with the service replaced by a controllable mock. The reason list
// is the real one, so the rendered options can't drift from the module.
import { act, create } from 'react-test-renderer';
import { Alert } from 'react-native';
import Button from '../components/Button';
import ReportAiResponseModal from '../components/ReportAiResponseModal';

jest.mock('../lib/supabase', () => ({ supabase: {} }));
// ThemeProvider (via Button) persists the theme through native AsyncStorage,
// which has no native module under jest — same stub the form smoke test uses.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
const mockReportResponse = jest.fn();
jest.mock('../lib/aiReports', () => ({
  AI_REPORT_REASONS: jest.requireActual('../lib/aiReports').AI_REPORT_REASONS,
  aiReportsService: { reportResponse: (...args) => mockReportResponse(...args) },
}));

const mount = async (props = {}) => {
  let tree;
  await act(async () => {
    tree = create(
      <ReportAiResponseModal
        visible
        messageContent="Pair oysters with a big tannic Cabernet."
        context="What goes with oysters?"
        onClose={() => {}}
        {...props}
      />
    );
  });
  return tree;
};

const findButton = (tree, title) =>
  tree.root.findAll((n) => n.type === Button && n.props.title === title)[0];

const pickReason = async (tree, label) => {
  const option = tree.root.findAll((n) => n.props.accessibilityLabel === label)[0];
  await act(async () => option.props.onPress());
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

test('renders every reason and keeps submit disabled until one is picked', async () => {
  const tree = await mount();
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('Inaccurate or misleading');
  expect(json).toContain('Inappropriate or offensive');
  expect(json).toContain('Unsafe advice');
  expect(json).toContain('Something else');

  expect(findButton(tree, 'Submit report').props.disabled).toBe(true);
  await pickReason(tree, 'Unsafe advice');
  expect(findButton(tree, 'Submit report').props.disabled).toBe(false);
  await act(async () => tree.unmount());
});

test('successful submit files the report and shows the confirmation state', async () => {
  mockReportResponse.mockResolvedValue({ success: true });
  const tree = await mount();

  await pickReason(tree, 'Unsafe advice');
  await act(async () => findButton(tree, 'Submit report').props.onPress());

  expect(mockReportResponse).toHaveBeenCalledWith({
    messageContent: 'Pair oysters with a big tannic Cabernet.',
    context: 'What goes with oysters?',
    reason: 'unsafe',
    details: '',
  });
  const json = JSON.stringify(tree.toJSON());
  expect(json).toContain('Your report was sent');
  expect(json).not.toContain('Submit report');
  await act(async () => tree.unmount());
});

test('failed submit alerts and stays on the form for a retry', async () => {
  mockReportResponse.mockResolvedValue({ success: false, error: 'offline' });
  const tree = await mount();

  await pickReason(tree, 'Inaccurate or misleading');
  await act(async () => findButton(tree, 'Submit report').props.onPress());

  expect(Alert.alert).toHaveBeenCalled();
  const json = JSON.stringify(tree.toJSON());
  expect(json).not.toContain('Your report was sent');
  expect(findButton(tree, 'Submit report')).toBeDefined();
  await act(async () => tree.unmount());
});

test('submit without a reason is a no-op', async () => {
  const tree = await mount();
  await act(async () => findButton(tree, 'Submit report').props.onPress());
  expect(mockReportResponse).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('renders nothing without message content', async () => {
  const tree = await mount({ messageContent: null });
  expect(tree.toJSON()).toBeNull();
  await act(async () => tree.unmount());
});
