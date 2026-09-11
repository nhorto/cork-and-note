// Everything in lib/ai.js that turns model text into data the UI acts on, and
// the photo path that turns a picker URI into what the model receives. Every
// bug this code can have is a shape bug, so the cases are real reply shapes.
import { Image } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { aiService } from '../lib/ai';

// lib/ai.js keeps these private; the numbers are the contract the server's
// per-image byte cap was sized against, so they are spelled out here.
const MAX_AI_IMAGE_EDGE = 1000;
const MAX_AI_IMAGE_EDGE_CEILING = 1568;

jest.mock('../lib/supabase', () => ({ supabase: require('../test-utils/fakeSupabase').currentFake() }));
jest.mock('expo-file-system', () => ({ EncodingType: { Base64: 'base64' }, readAsStringAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ SaveFormat: { JPEG: 'jpeg' }, manipulateAsync: jest.fn() }));

const fenced = (tag, body) => 'Here you go.\n```' + tag + '\n' + body + '\n```\nEnjoy!';

describe('parseSuggestions (wine-entry chat)', () => {
  test('requires the wine_suggestions fence: a bare object in prose is not a suggestion', () => {
    expect(aiService.parseSuggestions('Try {"name":"Octagon"} tonight')).toBeNull();
    expect(aiService.parseSuggestions('```json\n{"name":"Octagon"}\n```')).toBeNull();
    expect(aiService.parseSuggestions('')).toBeNull();
    expect(aiService.parseSuggestions(null)).toBeNull();
  });

  test.each([
    ['tight fence', '```wine_suggestions{"name":"Octagon"}```'],
    ['newline after tag', '```wine_suggestions\n{"name":"Octagon"}\n```'],
    ['spaces after tag', '```wine_suggestions   \n  {"name":"Octagon"}  \n```'],
    ['prose inside the fence around the object', '```wine_suggestions\nSure:\n{"name":"Octagon"}\nCheers\n```'],
  ])('reads the block with a %s', (_, text) => {
    expect(aiService.parseSuggestions(text)).toEqual({ name: 'Octagon' });
  });

  test('an unparseable block is null rather than a throw', () => {
    expect(aiService.parseSuggestions('```wine_suggestions\n{"name": Octagon}\n```')).toBeNull();
  });
});

describe('the lenient cellar parsers', () => {
  test.each([
    ['parseTonightsPick', 'tonights_pick'],
    ['parseDrinkWindow', 'drink_window'],
    ['parsePairing', 'food_pairing'],
    ['parseLabelScan', 'cellar_label'],
  ])('%s reads a tagged fence, an untagged fence, and bare JSON in prose', (fn, tag) => {
    expect(aiService[fn](fenced(tag, '{"a":1}'))).toEqual({ a: 1 });
    expect(aiService[fn]('```\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(aiService[fn]('Sure, here: {"a":1}. Cheers')).toEqual({ a: 1 });
    expect(aiService[fn]('No JSON here at all')).toBeNull();
    expect(aiService[fn]('')).toBeNull();
  });

  test('parseTastingMenu accepts an object with wines or a bare array', () => {
    expect(aiService.parseTastingMenu(fenced('tasting_menu', '{"wines":[{"wine_name":"A"}]}'))).toEqual({ wines: [{ wine_name: 'A' }] });
    expect(aiService.parseTastingMenu('Here: [{"wine_name":"A"},{"wine_name":"B"}] done')).toEqual([{ wine_name: 'A' }, { wine_name: 'B' }]);
  });
});

describe('parseFencedJson (guided Pro tools)', () => {
  test('reads a tagged block and reports a truncated one instead of splicing a partial result', () => {
    expect(aiService.parseFencedJson(fenced('trip_plan', '{"stops":[1,2]}'), 'trip_plan')).toEqual({ value: { stops: [1, 2] }, truncated: false });
    expect(aiService.parseFencedJson('Plan:\n```trip_plan\n{"stops":[1,', 'trip_plan')).toEqual({ value: null, truncated: true });
    expect(aiService.parseFencedJson('```trip_plan', 'trip_plan')).toEqual({ value: null, truncated: true });
  });

  test('accepts a whole-reply bare JSON value, but not JSON buried in prose', () => {
    expect(aiService.parseFencedJson('  {"a":1}  ', 'taste_report')).toEqual({ value: { a: 1 }, truncated: false });
    expect(aiService.parseFencedJson('[1,2]', 'taste_report')).toEqual({ value: [1, 2], truncated: false });
    expect(aiService.parseFencedJson('Here is {"a":1} for you', 'taste_report')).toEqual({ value: null, truncated: false });
    expect(aiService.parseFencedJson('', 'taste_report')).toEqual({ value: null, truncated: false });
    expect(aiService.parseFencedJson('{"a":1}', '')).toEqual({ value: null, truncated: false });
  });

  test('a tag that is a prefix of another tag does not read the wrong block', () => {
    // The wine-list tool reads `wine_list` and its picks step reads
    // `wine_list_picks`. A reply holding only a picks block must not be taken
    // for a scanned list.
    const picksOnly = fenced('wine_list_picks', '{"picks":[{"entry_id":1}]}');
    expect(aiService.parseFencedJson(picksOnly, 'wine_list')).toEqual({ value: null, truncated: false });
    expect(aiService.parseFencedJson(picksOnly, 'wine_list_picks')).toEqual({ value: { picks: [{ entry_id: 1 }] }, truncated: false });
  });
});

describe('getDisplayText', () => {
  test('strips every known structured block and keeps the prose', () => {
    const reply = 'A great match.\n```food_pairing\n{"dish":"lamb"}\n```\nAnd a backup:\n```tonights_pick\n{"bottleId":1}\n```';
    expect(aiService.getDisplayText(reply)).toBe('A great match.\n\nAnd a backup:');
  });

  test('keeps a code block the user actually asked for', () => {
    const reply = 'Here is the query:\n```sql\nselect * from wines\n```';
    expect(aiService.getDisplayText(reply)).toBe(reply);
    expect(aiService.getDisplayText('')).toBe('');
  });

  test('strips the guided-tool blocks too', () => {
    for (const tag of ['wine_list', 'wine_list_picks', 'taste_report', 'trip_plan', 'cellar_label', 'tasting_menu', 'drink_window', 'wine_suggestions']) {
      expect(aiService.getDisplayText(fenced(tag, '{"x":1}'))).toBe('Here you go.\n\nEnjoy!');
    }
  });
});

describe('photoToBase64', () => {
  const sized = (width, height) => jest.spyOn(Image, 'getSize').mockImplementation((uri, ok) => ok(width, height));
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    FileSystem.readAsStringAsync.mockResolvedValue('ORIGINAL');
    ImageManipulator.manipulateAsync.mockResolvedValue({ base64: 'SMALL' });
  });
  afterEach(() => jest.restoreAllMocks());

  test('a photo within the cap is sent as read, typed by its extension', async () => {
    sized(800, 600);
    expect(await aiService.photoToBase64('file:///a/label.PNG')).toEqual({ base64: 'ORIGINAL', mediaType: 'image/png' });
    expect(await aiService.photoToBase64('file:///a/label.webp')).toEqual({ base64: 'ORIGINAL', mediaType: 'image/webp' });
    expect(await aiService.photoToBase64('file:///a/label.jpg')).toEqual({ base64: 'ORIGINAL', mediaType: 'image/jpeg' });
    expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
  });

  test('anything without a known extension is declared JPEG, which is what the picker produces', async () => {
    // A HEIC or extension-less URI would reach the server labelled JPEG. The
    // pickers are configured to hand back JPEGs, so this pins the assumption.
    sized(800, 600);
    expect((await aiService.photoToBase64('file:///a/IMG_0001.HEIC')).mediaType).toBe('image/jpeg');
    expect((await aiService.photoToBase64('content://media/1234')).mediaType).toBe('image/jpeg');
  });

  test('an oversized photo is downscaled on its long edge, compressed, and sent as JPEG', async () => {
    sized(4000, 3000);
    expect(await aiService.photoToBase64('file:///a/label.png')).toEqual({ base64: 'SMALL', mediaType: 'image/jpeg' });
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      'file:///a/label.png',
      [{ resize: { width: MAX_AI_IMAGE_EDGE } }],
      { compress: 0.8, format: 'jpeg', base64: true },
    );
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();

    sized(3000, 4000);
    await aiService.photoToBase64('file:///a/tall.jpg', { maxEdge: 1568 });
    expect(ImageManipulator.manipulateAsync).toHaveBeenLastCalledWith(expect.anything(), [{ resize: { height: 1568 } }], expect.anything());
  });

  test('the edge cap is bounded so a caller cannot ship a full-size original or a thumbnail', async () => {
    sized(5000, 5000);
    await aiService.photoToBase64('file:///a.jpg', { maxEdge: 9999 });
    expect(ImageManipulator.manipulateAsync).toHaveBeenLastCalledWith(expect.anything(), [{ resize: { width: MAX_AI_IMAGE_EDGE_CEILING } }], expect.anything());
    await aiService.photoToBase64('file:///a.jpg', { maxEdge: 10 });
    expect(ImageManipulator.manipulateAsync).toHaveBeenLastCalledWith(expect.anything(), [{ resize: { width: 400 } }], expect.anything());
    await aiService.photoToBase64('file:///a.jpg', { maxEdge: 'nonsense' });
    expect(ImageManipulator.manipulateAsync).toHaveBeenLastCalledWith(expect.anything(), [{ resize: { width: MAX_AI_IMAGE_EDGE } }], expect.anything());
  });

  test('a failed downscale falls back to the original bytes', async () => {
    sized(4000, 3000);
    ImageManipulator.manipulateAsync.mockRejectedValue(new Error('no manipulator'));
    expect(await aiService.photoToBase64('file:///a/label.jpg')).toEqual({ base64: 'ORIGINAL', mediaType: 'image/jpeg' });
    ImageManipulator.manipulateAsync.mockResolvedValue({});
    expect(await aiService.photoToBase64('file:///a/label.jpg')).toEqual({ base64: 'ORIGINAL', mediaType: 'image/jpeg' });
  });

  test('unreadable dimensions still send the original; an unreadable file is null', async () => {
    jest.spyOn(Image, 'getSize').mockImplementation((uri, ok, fail) => fail(new Error('bad image')));
    expect(await aiService.photoToBase64('file:///a/label.jpg')).toEqual({ base64: 'ORIGINAL', mediaType: 'image/jpeg' });
    FileSystem.readAsStringAsync.mockRejectedValue(new Error('gone'));
    expect(await aiService.photoToBase64('file:///a/label.jpg')).toBeNull();
  });
});
