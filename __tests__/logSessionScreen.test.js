// The log session screen, the UI over the app's primary write path: how the
// route params seed the form, what a save sends, what the user is told when
// photos or notes were dropped, and the edit mode branches (hydrate, delete
// on empty, failed load).
import { act, create } from 'react-test-renderer';
import { Alert } from 'react-native';
import { visitsService } from '../lib/visits';
import LogSessionScreen from '../app/log-session';

jest.mock('expo-router', () => {
  const router = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
  return {
    __router: router,
    __params: { current: {} },
    useRouter: () => router,
    useLocalSearchParams: () => require('expo-router').__params.current,
  };
});
const { __router: mockRouter, __params: mockParams } = require('expo-router');
let mockForm;
jest.mock('../components/LogSessionForm', () => (props) => { mockForm = props; return null; });
jest.mock('../lib/haptics', () => ({ notifySuccess: jest.fn() }));
jest.mock('../lib/visits', () => ({ visitsService: { createVisit: jest.fn(), updateSession: jest.fn(), deleteVisit: jest.fn(), getVisit: jest.fn() } }));
jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function mount(params = {}) {
  mockParams.current = params;
  let tree;
  await act(async () => { tree = create(<LogSessionScreen />); });
  await flush();
  return tree;
}
const save = (data) => act(async () => { await mockForm.onSave(data); });
const lastAlert = () => Alert.alert.mock.calls.at(-1);

const draft = { date: '2026-09-11', placeType: 'winery', placeName: 'Barboursville', wines: [{ name: 'Octagon', overallRating: 4 }] };

beforeEach(() => {
  jest.clearAllMocks();
  mockForm = null;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockRouter.canGoBack.mockReturnValue(true);
});
afterEach(() => Alert.alert.mockRestore());

describe('seeding the form from the route', () => {
  test('a winery handed over from its detail page is pre-filled with numeric coordinates', async () => {
    await mount({ mode: 'winery', wineryId: '7', wineryName: 'Barboursville', lat: '38.17', lng: '-78.28' });
    expect(mockForm.winery).toEqual({ id: '7', directoryId: null, name: 'Barboursville', latitude: 38.17, longitude: -78.28 });
  });

  test('a directory preview hands over its directory id with no winery id (#270)', async () => {
    await mount({ mode: 'winery', directoryId: '7', wineryName: 'Barboursville', lat: '38.17', lng: '-78.28' });
    expect(mockForm.winery).toEqual({ id: null, directoryId: 7, name: 'Barboursville', latitude: 38.17, longitude: -78.28 });
  });

  test('a winery without coordinates keeps them null rather than NaN', async () => {
    await mount({ mode: 'winery', wineryId: '7', wineryName: 'Somewhere' });
    expect(mockForm.winery).toEqual({ id: '7', directoryId: null, name: 'Somewhere', latitude: null, longitude: null });
  });

  test('a prefill from a guided tool honours only the three identity fields, trimmed and capped', async () => {
    const prefill = JSON.stringify({ winemaker: '  Barboursville ', name: 'Octagon', year: '2019', overallRating: 5, notes: 'x'.repeat(500), user_id: 'evil' });
    await mount({ mode: 'wine', prefill });
    expect(mockForm.prefillWine).toEqual({ winemaker: 'Barboursville', name: 'Octagon', year: '2019' });
    await mount({ mode: 'wine', prefill: JSON.stringify({ name: 'x'.repeat(300) }) });
    expect(mockForm.prefillWine.name).toHaveLength(120);
  });

  test.each([['not json'], ['{}'], [JSON.stringify({ overallRating: 5 })], ['']])('a malformed or empty prefill (%s) is simply no prefill', async (prefill) => {
    await mount({ mode: 'wine', prefill });
    expect(mockForm.prefillWine).toBeNull();
  });
});

describe('creating a log', () => {
  test('a saved session goes home and reports the count', async () => {
    visitsService.createVisit.mockResolvedValue({ success: true, visit: { id: 1 }, photosFailed: 0, notesFailed: 0 });
    await mount({ mode: 'wine' });
    await save({ ...draft, wines: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] });
    expect(visitsService.createVisit).toHaveBeenCalledWith(expect.objectContaining({ placeName: 'Barboursville' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/home');
    expect(lastAlert()).toEqual(['Logged', 'Your session of 3 wines was saved.']);
  });

  test('dropped photos and notes are named in the confirmation instead of vanishing silently', async () => {
    visitsService.createVisit.mockResolvedValue({ success: true, visit: { id: 1 }, photosFailed: 2, notesFailed: 1 });
    await mount({ mode: 'wine' });
    await save(draft);
    const [title, message] = lastAlert();
    expect(title).toBe('Logged');
    expect(message).toMatch(/Your wine was saved\./);
    expect(message).toMatch(/2 photos couldn't be uploaded/);
    expect(message).toMatch(/1 flavor note couldn't be saved/);
  });

  test('a failed save keeps the user on the form with the reason', async () => {
    visitsService.createVisit.mockResolvedValue({ success: false, error: 'User not authenticated' });
    await mount({ mode: 'wine' });
    await save(draft);
    expect(lastAlert()).toEqual(['Could not save', 'User not authenticated']);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('a thrown save is caught the same way', async () => {
    visitsService.createVisit.mockRejectedValue(new Error('Network request failed'));
    await mount({ mode: 'wine' });
    await save(draft);
    expect(lastAlert()).toEqual(['Could not save', 'Network request failed']);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  test('a second tap while saving does not save twice', async () => {
    let release;
    visitsService.createVisit.mockReturnValue(new Promise((r) => { release = r; }));
    await mount({ mode: 'wine' });
    act(() => { mockForm.onSave(draft); });
    await flush();
    await save(draft);
    expect(visitsService.createVisit).toHaveBeenCalledTimes(1);
    await act(async () => { release({ success: true, visit: { id: 1 } }); });
  });
});

describe('editing a log', () => {
  const saved = { id: 5, visit_date: '2026-09-01', wines: [{ id: 11, wine_name: 'Octagon' }] };

  test('hydrates the form from the saved session', async () => {
    visitsService.getVisit.mockResolvedValue({ success: true, visit: saved });
    await mount({ editVisitId: '5' });
    expect(visitsService.getVisit).toHaveBeenCalledWith('5');
    expect(mockForm.initialSession).toEqual(saved);
    expect(mockForm.prefillWine).toBeNull();
  });

  test('a session that cannot be loaded alerts and goes back instead of showing an empty editor', async () => {
    visitsService.getVisit.mockResolvedValue({ success: false, error: 'not found' });
    await mount({ editVisitId: '5' });
    expect(lastAlert()).toEqual(['Could not open log', 'not found']);
    expect(mockRouter.back).toHaveBeenCalled();
    expect(visitsService.updateSession).not.toHaveBeenCalled();
  });

  test('saving changes updates in place and goes back', async () => {
    visitsService.getVisit.mockResolvedValue({ success: true, visit: saved });
    visitsService.updateSession.mockResolvedValue({ success: true, photosFailed: 0, notesFailed: 0 });
    await mount({ editVisitId: '5' });
    await save({ ...draft });
    expect(visitsService.updateSession).toHaveBeenCalledWith('5', expect.objectContaining({ placeName: 'Barboursville' }));
    expect(visitsService.createVisit).not.toHaveBeenCalled();
    expect(mockRouter.back).toHaveBeenCalled();
    expect(lastAlert()).toEqual(['Log updated', 'Your changes were saved.']);
  });

  test('removing every wine asks before deleting the whole log, and only deletes on confirmation', async () => {
    visitsService.getVisit.mockResolvedValue({ success: true, visit: saved });
    visitsService.deleteVisit.mockResolvedValue({ success: true });
    await mount({ editVisitId: '5' });
    await save({ ...draft, wines: [] });
    expect(visitsService.updateSession).not.toHaveBeenCalled();
    expect(visitsService.deleteVisit).not.toHaveBeenCalled();
    const [title, , buttons] = lastAlert();
    expect(title).toBe('Remove this log?');
    await act(async () => buttons.find((b) => b.text === 'Delete log').onPress());
    await flush();
    expect(visitsService.deleteVisit).toHaveBeenCalledWith('5');
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
