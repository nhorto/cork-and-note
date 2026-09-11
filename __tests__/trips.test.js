// "Plan a wine day" arithmetic (lib/trips.js, lib/tripSchedule.js): the
// schedule is built in code from user times and drive legs, the candidate
// shortlist ranks and dedupes predictably, the sommelier block is validated
// against the real stops, and Directions opens the right app per platform.
import {
  buildSchedule,
  buildTripUserMessage,
  buildTripSystemPrompt,
  candidateWineries,
  dateChips,
  directionsFallbackUrl,
  directionsUrl,
  formatClock,
  hoursForDate,
  isProRequired,
  isValidDateString,
  nextSaturday,
  parseTime,
  parseTripPlan,
  scheduleForPlan,
} from '../lib/trips';

jest.mock('../lib/supabase', () => ({ supabase: { auth: {}, from: jest.fn(), functions: { invoke: jest.fn() } } }));
jest.mock('../lib/ai', () => ({ aiService: { sendMessage: jest.fn(), parseFencedJson: jest.fn() } }));
jest.mock('../lib/places', () => ({ placesService: {} }));
jest.mock('../lib/visits', () => ({ visitsService: {} }));
jest.mock('../lib/wishlist', () => ({ wishlistService: {} }));
jest.mock('../lib/wineryDirectory', () => ({ wineryDirectoryService: {} }));

const STOPS = [{ name: 'Stone Ridge' }, { name: 'Hollow Creek' }, { name: 'Bluebird Farm' }];
const LEGS = [{ seconds: 28 * 60 }, { seconds: 19 * 60 }, { seconds: 12 * 60 }];

describe('buildSchedule', () => {
  it('walks leave, drive, stop, lunch and finish in minutes since midnight', () => {
    const schedule = buildSchedule({
      startTime: '11:00',
      endTime: '17:00',
      stops: STOPS.slice(0, 2),
      legs: LEGS.slice(0, 2),
      visitMinutes: 75,
      lunchMinutes: 60,
      lunchAfterStop: 1,
    });
    expect(schedule.items.map((i) => i.kind)).toEqual(['leave', 'drive', 'stop', 'lunch', 'drive', 'stop', 'finish']);
    const [leave, drive1, stop1, lunch, drive2, stop2, finish] = schedule.items;
    expect(leave.time).toBe('11:00');
    expect(drive1).toMatchObject({ minutes: 28, toIndex: 0, unknown: false });
    expect(stop1).toMatchObject({ index: 0, arrive: '11:28', depart: '12:43', visitMinutes: 75 });
    expect(lunch).toEqual({ kind: 'lunch', start: '12:43', end: '13:43' });
    expect(drive2).toMatchObject({ minutes: 19, toIndex: 1 });
    expect(stop2).toMatchObject({ index: 1, arrive: '14:02', depart: '15:17' });
    expect(finish.time).toBe('15:17');
    expect(schedule.endsAt).toBe('15:17');
    expect(schedule.overrunMinutes).toBe(0);
    expect(schedule.unknownLegs).toBe(false);
  });

  it('reports an overrun past the finish time and honours per-stop visit lengths', () => {
    const schedule = buildSchedule({
      startTime: '12:00',
      endTime: '16:00',
      stops: [{ name: 'A', visitMinutes: 90 }, { name: 'B' }, { name: 'C' }],
      legs: LEGS,
      visitMinutes: 75,
      lunchMinutes: 60,
      lunchAfterStop: 1,
    });
    // 12:00 +28 → 12:28, +90 → 13:58, lunch → 14:58, +19 → 15:17, +75 → 16:32, +12 → 16:44, +75 → 17:59
    expect(schedule.endsAt).toBe('17:59');
    expect(schedule.overrunMinutes).toBe(119);
    expect(schedule.items.find((i) => i.kind === 'stop' && i.index === 0).visitMinutes).toBe(90);
  });

  it('skips lunch when nothing follows it and when lunchMinutes is 0', () => {
    const afterLast = buildSchedule({ stops: STOPS.slice(0, 1), legs: LEGS.slice(0, 1), lunchAfterStop: 1 });
    expect(afterLast.items.some((i) => i.kind === 'lunch')).toBe(false);
    const noLunch = buildSchedule({ stops: STOPS, legs: LEGS, lunchMinutes: 0 });
    expect(noLunch.items.some((i) => i.kind === 'lunch')).toBe(false);
  });

  it('flags a missing leg as unknown instead of inventing a drive time', () => {
    const schedule = buildSchedule({ stops: STOPS.slice(0, 2), legs: [{ seconds: 600 }] });
    const drives = schedule.items.filter((i) => i.kind === 'drive');
    expect(drives[0]).toMatchObject({ minutes: 10, unknown: false });
    expect(drives[1]).toMatchObject({ minutes: null, unknown: true });
    expect(schedule.unknownLegs).toBe(true);
  });

  it('adds the drive home when a return leg is present', () => {
    const schedule = buildSchedule({ stops: STOPS.slice(0, 1), legs: [{ seconds: 600 }, { seconds: 900 }], lunchMinutes: 0 });
    const last = schedule.items[schedule.items.length - 2];
    expect(last).toMatchObject({ kind: 'drive', minutes: 15, toIndex: null });
    expect(schedule.endsAt).toBe('12:40');
  });

  it('is what scheduleForPlan rebuilds from a stored plan', () => {
    const plan = {
      start_time: '10:00',
      end_time: '16:00',
      stops: STOPS.slice(0, 2),
      legs: LEGS.slice(0, 2),
      settings: { visitMinutes: 60, lunchMinutes: 45, lunchAfterStop: 1 },
    };
    const schedule = scheduleForPlan(plan);
    expect(schedule.items.find((i) => i.kind === 'lunch')).toEqual({ kind: 'lunch', start: '11:28', end: '12:13' });
  });
});

describe('time and date helpers', () => {
  it('parses and formats clock times', () => {
    expect(parseTime('11:05')).toBe(665);
    expect(parseTime('9:30')).toBe(570);
    expect(parseTime('25:00')).toBeNull();
    expect(parseTime('noon')).toBeNull();
    expect(formatClock('13:05')).toBe('1:05 PM');
    expect(formatClock('00:15')).toBe('12:15 AM');
  });

  it('defaults to the coming Saturday and offers the next seven days', () => {
    expect(nextSaturday(new Date(2026, 8, 11))).toBe('2026-09-12'); // a Friday
    expect(nextSaturday(new Date(2026, 8, 12))).toBe('2026-09-19'); // already Saturday
    const chips = dateChips(new Date(2026, 8, 11));
    expect(chips).toHaveLength(7);
    expect(chips[0]).toEqual({ value: '2026-09-12', label: 'Sat 12' });
    expect(chips[6].value).toBe('2026-09-18');
  });

  it('validates typed dates strictly', () => {
    expect(isValidDateString('2026-10-03')).toBe(true);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('10/03/2026')).toBe(false);
  });

  it('picks the trip weekday out of Google hours text and never guesses', () => {
    const hours = ['Monday: Closed', 'Saturday: 11:00 AM – 5:00 PM', 'Sunday: 12:00 – 5:00 PM'];
    expect(hoursForDate(hours, '2026-09-12')).toBe('11:00 AM – 5:00 PM');
    expect(hoursForDate(hours, '2026-09-15')).toBeNull();
    expect(hoursForDate(null, '2026-09-12')).toBeNull();
    expect(hoursForDate(hours, 'someday')).toBeNull();
  });
});

describe('candidateWineries', () => {
  const origin = { lat: 38.9, lng: -77.9 };
  const saved = [
    { wineryId: 1, name: 'Stone Ridge Vineyards', latitude: 38.95, longitude: -77.95, source: 'wishlist' },
    { wineryId: 2, name: 'Far Away Cellars', latitude: 40.5, longitude: -77.9, source: 'visited' },
    { wineryId: 3, name: 'Hollow Creek', latitude: 38.91, longitude: -77.91, source: 'visited' },
  ];
  const directory = [
    { id: 10, name: 'Stone Ridge Vineyards', latitude: 38.951, longitude: -77.951, city: 'Delaplane', state: 'VA', website: 'https://stoneridge.example' },
    { id: 11, name: 'Bluebird Farm', latitude: 38.905, longitude: -77.905, city: 'Marshall', state: 'VA' },
    { id: 12, name: 'Stone Ridge Vineyards', latitude: 38.7, longitude: -77.7, city: 'Elsewhere', state: 'VA' },
  ];

  it('dedupes a saved winery against its directory twin and keeps the directory id', () => {
    const list = candidateWineries({ origin, saved, directory, savedFirst: false });
    const stoneRidge = list.filter((c) => c.name === 'Stone Ridge Vineyards');
    expect(stoneRidge).toHaveLength(2); // the near one merged, the far same-name one kept
    expect(stoneRidge[0]).toMatchObject({ source: 'wishlist', wineryId: 1, directoryId: 10, website: 'https://stoneridge.example', city: 'Delaplane' });
  });

  it('drops anything outside the radius and sorts by distance', () => {
    const list = candidateWineries({ origin, saved, directory, savedFirst: false, radiusKm: 40 });
    expect(list.map((c) => c.name)).toEqual(['Bluebird Farm', 'Hollow Creek', 'Stone Ridge Vineyards', 'Stone Ridge Vineyards']);
    expect(list.some((c) => c.name === 'Far Away Cellars')).toBe(false);
    expect(list[0].distanceKm).toBeLessThan(list[1].distanceKm);
  });

  it('puts saved wineries first when asked, nearest within each group', () => {
    const list = candidateWineries({ origin, saved, directory, savedFirst: true });
    expect(list.map((c) => c.source)).toEqual(['visited', 'wishlist', 'directory', 'directory']);
    expect(list[0].name).toBe('Hollow Creek');
    expect(list[2].name).toBe('Bluebird Farm');
  });

  it('caps the list and returns nothing without an origin', () => {
    expect(candidateWineries({ origin, saved, directory, limit: 2 })).toHaveLength(2);
    expect(candidateWineries({ origin: null, saved, directory })).toEqual([]);
  });
});

describe('sommelier trip_plan block', () => {
  it('keeps only notes for real stops, in order, and at most four tips', () => {
    const parsed = parseTripPlan(
      {
        summary: '  A relaxed day.  ',
        stop_notes: [
          { index: 2, note: 'Ask about the Petit Verdot.' },
          { index: 1, note: 'Start here.' },
          { index: 3, note: 'Not a real stop.' },
          { index: 1, note: 'Duplicate.' },
          { index: 'x', note: 'Garbage.' },
        ],
        tips: ['Water', 'Snacks', 'Call ahead', 'Cash for tips', 'Too many'],
      },
      2
    );
    expect(parsed).toEqual({
      summary: 'A relaxed day.',
      stopNotes: [
        { index: 0, note: 'Start here.' },
        { index: 1, note: 'Ask about the Petit Verdot.' },
      ],
      tips: ['Water', 'Snacks', 'Call ahead', 'Cash for tips'],
    });
  });

  it('returns null for an empty or non-object reply', () => {
    expect(parseTripPlan(null, 2)).toBeNull();
    expect(parseTripPlan({ stop_notes: [], tips: [] }, 2)).toBeNull();
  });

  it('hands the model the computed schedule and forbids inventing facts', () => {
    const schedule = buildSchedule({ stops: STOPS.slice(0, 2), legs: LEGS.slice(0, 2) });
    const message = buildTripUserMessage({
      date: '2026-09-12',
      startLabel: 'Middleburg, VA',
      stops: [{ name: 'Stone Ridge', city: 'Delaplane', state: 'VA' }, { name: 'Hollow Creek' }],
      schedule,
    });
    expect(message).toContain('1. Stone Ridge (Delaplane, VA), 28 min drive, arrive 11:28, leave 12:43');
    expect(message).toContain('Lunch break: 12:43 to 13:43');
    expect(message).toContain('Planned finish: 15:17');
    const system = buildTripSystemPrompt();
    expect(system).toMatch(/Never invent or change opening hours/);
    expect(system).toContain('```trip_plan');
    expect(system).not.toContain('—');
    expect(message).not.toContain('—');
  });
});

describe('directions and gating', () => {
  const stop = { lat: 38.95, lng: -77.95, name: 'Stone Ridge' };

  it('opens the native maps app per platform with a web fallback', () => {
    expect(directionsUrl(stop, 'ios')).toBe('maps://?daddr=38.95,-77.95');
    expect(directionsUrl(stop, 'android')).toBe('google.navigation:q=38.95,-77.95');
    expect(directionsUrl(stop, 'web')).toBe('https://www.google.com/maps/dir/?api=1&destination=38.95,-77.95');
    expect(directionsFallbackUrl(stop)).toBe('https://www.google.com/maps/dir/?api=1&destination=38.95,-77.95');
  });

  it('treats both server paywall codes as Pro-required and nothing else', () => {
    expect(isProRequired({ code: 'pro_required' })).toBe(true);
    expect(isProRequired({ code: 'free_limit_reached' })).toBe(true);
    expect(isProRequired({ code: undefined, error: 'Offline' })).toBe(false);
    expect(isProRequired(null)).toBe(false);
  });
});
