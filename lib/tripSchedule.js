// lib/tripSchedule.js: the pure half of "Plan a wine day" (no Supabase, no
// network) so the arithmetic is unit-testable the way lib/geo.js is.
// lib/trips.js re-exports everything here next to the services.
//
// Design brief: docs/research/pro-features-ux-and-implementation-2026-09-11.md
// section 7. The schedule is computed in CODE from user-chosen times, per-stop
// visit lengths and drive legs from the routes function. The sommelier only
// explains a schedule it is handed; it never invents hours or drive times.
import { Platform } from 'react-native';
import { haversineKm } from './geo';
import { softenDashes } from './text';

export const DEFAULTS = Object.freeze({
  startTime: '11:00',
  endTime: '17:00',
  visitMinutes: 75,
  lunchMinutes: 60,
  lunchAfterStop: 1, // 1-based: lunch after the first stop. 0 means no lunch.
  radiusKm: 40,
  stopCount: 2,
});

export const VISIT_MINUTE_OPTIONS = [45, 60, 75, 90];
export const START_TIME_OPTIONS = ['10:00', '11:00', '12:00'];
export const END_TIME_OPTIONS = ['16:00', '17:00', '18:00'];
export const STOP_COUNT_OPTIONS = [2, 3];
export const MAX_STOPS = 4;

export const TRANSPORT_REMINDER =
  'Arrange a designated driver or other transportation if you are tasting.';

// ── Time helpers (minutes since midnight, no Date objects) ─────────────────

/** 'HH:MM' or 'H:MM' to minutes since midnight; null when malformed. */
export function parseTime(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Minutes since midnight to 'HH:MM'. Wraps past midnight so 25:10 reads 01:10. */
export function formatTime(totalMinutes) {
  const wrapped = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const minutes = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** 'HH:MM' to a friendlier '11:00 AM'. */
export function formatClock(hhmm) {
  const minutes = parseTime(hhmm);
  if (minutes === null) return hhmm || '';
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

// ── Date helpers (calendar strings, local to the trip) ─────────────────────

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const probe = new Date(y, m - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d;
}

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fromDateString(value) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The date `days` after `dateStr`, as 'YYYY-MM-DD'. */
export function addDays(dateStr, days) {
  const date = fromDateString(dateStr);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

/** The upcoming Saturday (a week out if today is Saturday), as 'YYYY-MM-DD'. */
export function nextSaturday(now = new Date()) {
  const today = toDateString(now);
  const ahead = (6 - now.getDay() + 7) % 7 || 7;
  return addDays(today, ahead);
}

/** Chips for the next `count` days starting tomorrow: { value, label }. */
export function dateChips(now = new Date(), count = 7) {
  const today = toDateString(now);
  return Array.from({ length: count }, (_, i) => {
    const value = addDays(today, i + 1);
    const date = fromDateString(value);
    return { value, label: `${WEEKDAYS[date.getDay()].slice(0, 3)} ${date.getDate()}` };
  });
}

export function weekdayName(dateStr) {
  if (!isValidDateString(dateStr)) return null;
  return WEEKDAYS[fromDateString(dateStr).getDay()];
}

/** 'Saturday, September 19'. Falls back to the raw string when malformed. */
export function formatTripDate(dateStr) {
  if (!isValidDateString(dateStr)) return dateStr || '';
  const date = fromDateString(dateStr);
  return `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/**
 * The line for the trip's weekday out of Google's weekdayDescriptions
 * ("Saturday: 11:00 AM – 5:00 PM"). Display only; never parsed into the
 * schedule (the brief is explicit: hours text is not a schedule input).
 */
export function hoursForDate(weekdayHours, dateStr) {
  const day = weekdayName(dateStr);
  if (!day || !Array.isArray(weekdayHours)) return null;
  const line = weekdayHours.find((entry) => typeof entry === 'string' && entry.startsWith(`${day}:`));
  if (!line) return null;
  return line.slice(day.length + 1).trim() || null;
}

// ── Schedule ───────────────────────────────────────────────────────────────

/**
 * Turn user-chosen times, stops and drive legs into a timeline.
 *
 * items: { kind:'leave', time }
 *        { kind:'drive', minutes|null, toIndex (null for the drive home), unknown }
 *        { kind:'stop', index, arrive, depart, visitMinutes }
 *        { kind:'lunch', start, end }
 *        { kind:'finish', time }
 * Times are 'HH:MM'. A missing leg contributes zero minutes and is flagged
 * `unknown` rather than guessed. `lunchAfterStop` is 1-based (1 = after the
 * first stop); lunch is only inserted when another stop follows it.
 */
export function buildSchedule({
  startTime = DEFAULTS.startTime,
  endTime = DEFAULTS.endTime,
  stops = [],
  legs = [],
  visitMinutes = DEFAULTS.visitMinutes,
  lunchMinutes = DEFAULTS.lunchMinutes,
  lunchAfterStop = DEFAULTS.lunchAfterStop,
} = {}) {
  const start = parseTime(startTime) ?? parseTime(DEFAULTS.startTime);
  const end = parseTime(endTime) ?? parseTime(DEFAULTS.endTime);
  const legList = Array.isArray(legs) ? legs : [];
  const items = [{ kind: 'leave', time: formatTime(start) }];
  let clock = start;

  const legMinutes = (leg) => {
    const seconds = leg?.seconds;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return null;
    return Math.round(seconds / 60);
  };

  stops.forEach((stop, index) => {
    const minutes = legMinutes(legList[index]);
    items.push({ kind: 'drive', minutes, toIndex: index, unknown: minutes === null });
    clock += minutes ?? 0;

    const perStop = Number.isFinite(stop?.visitMinutes) && stop.visitMinutes > 0
      ? Math.round(stop.visitMinutes)
      : visitMinutes;
    const arrive = clock;
    const depart = clock + perStop;
    items.push({
      kind: 'stop',
      index,
      arrive: formatTime(arrive),
      depart: formatTime(depart),
      visitMinutes: perStop,
    });
    clock = depart;

    const lunchHere = lunchMinutes > 0 && lunchAfterStop === index + 1 && index < stops.length - 1;
    if (lunchHere) {
      items.push({ kind: 'lunch', start: formatTime(clock), end: formatTime(clock + lunchMinutes) });
      clock += lunchMinutes;
    }
  });

  // A trailing leg beyond the stops is the drive back to the start.
  if (stops.length > 0 && legList.length > stops.length) {
    const minutes = legMinutes(legList[stops.length]);
    items.push({ kind: 'drive', minutes, toIndex: null, unknown: minutes === null });
    clock += minutes ?? 0;
  }

  items.push({ kind: 'finish', time: formatTime(clock) });

  return {
    items,
    endsAt: formatTime(clock),
    overrunMinutes: Math.max(0, clock - end),
    unknownLegs: items.some((item) => item.kind === 'drive' && item.unknown),
  };
}

// ── Candidates ─────────────────────────────────────────────────────────────

const normalizeName = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');

/**
 * A ranked shortlist for the stop picker.
 *   saved:     [{ wineryId, name, latitude, longitude, source:'wishlist'|'visited', city, state }]
 *   directory: [{ id, name, latitude, longitude, city, state, website }]
 * Deduped by name within ~2 km (a saved winery that came from a directory pin
 * keeps its directoryId and website). Saved first when asked, then nearest.
 */
export function candidateWineries({
  origin,
  radiusKm = DEFAULTS.radiusKm,
  saved = [],
  directory = [],
  savedFirst = true,
  limit = 12,
} = {}) {
  if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng)) return [];

  const within = (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const distanceKm = haversineKm(origin.lat, origin.lng, lat, lng);
    return distanceKm <= radiusKm ? distanceKm : null;
  };

  const list = [];
  for (const item of saved) {
    const distanceKm = within(item.latitude, item.longitude);
    if (distanceKm === null) continue;
    list.push({
      key: `winery:${item.wineryId}`,
      name: item.name,
      lat: item.latitude,
      lng: item.longitude,
      distanceKm,
      source: item.source === 'visited' ? 'visited' : 'wishlist',
      wineryId: item.wineryId,
      directoryId: item.directoryId ?? null,
      city: item.city ?? null,
      state: item.state ?? null,
      website: item.website ?? null,
    });
  }

  for (const item of directory) {
    const distanceKm = within(item.latitude, item.longitude);
    if (distanceKm === null) continue;
    const twin = list.find(
      (existing) =>
        normalizeName(existing.name) === normalizeName(item.name) &&
        haversineKm(existing.lat, existing.lng, item.latitude, item.longitude) < 2
    );
    if (twin) {
      if (twin.directoryId == null) twin.directoryId = item.id;
      if (!twin.website && item.website) twin.website = item.website;
      if (!twin.city && item.city) twin.city = item.city;
      if (!twin.state && item.state) twin.state = item.state;
      continue;
    }
    list.push({
      key: `directory:${item.id}`,
      name: item.name,
      lat: item.latitude,
      lng: item.longitude,
      distanceKm,
      source: 'directory',
      wineryId: null,
      directoryId: item.id,
      city: item.city ?? null,
      state: item.state ?? null,
      website: item.website ?? null,
    });
  }

  const isSaved = (c) => c.source !== 'directory';
  list.sort((a, b) => {
    if (savedFirst && isSaved(a) !== isSaved(b)) return isSaved(a) ? -1 : 1;
    return a.distanceKm - b.distanceKm;
  });
  return list.slice(0, limit);
}

/** A bounding box `radiusKm` around a point, for wineryDirectoryService.getInBounds. */
export function boundsAround({ lat, lng, radiusKm = DEFAULTS.radiusKm }) {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return {
    north: Math.min(85, lat + latDelta),
    south: Math.max(-85, lat - latDelta),
    east: Math.min(180, lng + lngDelta),
    west: Math.max(-180, lng - lngDelta),
  };
}

// ── Directions (external navigation; the itinerary is mapless) ─────────────

export function directionsUrl({ lat, lng }, platform = Platform.OS) {
  if (platform === 'ios') return `maps://?daddr=${lat},${lng}`;
  if (platform === 'android') return `google.navigation:q=${lat},${lng}`;
  return directionsFallbackUrl({ lat, lng });
}

export function directionsFallbackUrl({ lat, lng }) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

// ── Sommelier notes (one optional Sonnet call, task 'trip_plan') ───────────

export function buildTripSystemPrompt() {
  return `You are Cork & Note's in-house wine sommelier, helping a user get the most out of a day of winery visits they have ALREADY planned. The schedule you are given was computed from the user's chosen times, their chosen visit lengths, and real drive-time estimates. It is the plan; you comment on it.

Rules:
- Never invent or change opening hours, tasting prices, reservation requirements, wine lists, or drive times. If something matters and you do not know it, say to check the winery's website.
- Do not estimate how much anyone can drink or say anything about driving after tasting beyond a plain reminder to arrange a designated driver or other transportation.
- Explain the order, suggest what to look for or ask at each stop based on the region and general knowledge, and offer practical tips (water, snacks, calling ahead on busy weekends).
- Keep it warm and concrete. Refer to stops by their number and name.
- No em dashes anywhere in your reply.

Respond with one short friendly sentence, THEN a single fenced code block in EXACTLY this format (valid JSON, no comments, no trailing commas):

\`\`\`trip_plan
{
  "summary": "two or three sentences about the day as planned",
  "stop_notes": [
    { "index": <stop number, starting at 1>, "note": "one or two sentences for this stop" }
  ],
  "tips": ["short practical tip", "another tip"]
}
\`\`\`

Include a stop_notes entry for every stop, in order. Keep tips to at most four.`;
}

export function buildTripUserMessage({ date, startLabel, stops = [], schedule } = {}) {
  const lines = [];
  lines.push(`Date: ${formatTripDate(date)}${date ? ` (${date})` : ''}`);
  if (startLabel) lines.push(`Starting from: ${startLabel}`);
  const stopItems = (schedule?.items || []).filter((item) => item.kind === 'stop');
  const driveItems = (schedule?.items || []).filter((item) => item.kind === 'drive');
  const lunch = (schedule?.items || []).find((item) => item.kind === 'lunch');

  lines.push('Stops, in order:');
  stops.forEach((stop, index) => {
    const timing = stopItems.find((item) => item.index === index);
    const drive = driveItems.find((item) => item.toIndex === index);
    const where = [stop.city, stop.state].filter(Boolean).join(', ');
    const driveText = drive
      ? drive.unknown
        ? 'drive time unknown'
        : `${drive.minutes} min drive`
      : '';
    const timeText = timing ? `arrive ${timing.arrive}, leave ${timing.depart}` : '';
    lines.push(
      `${index + 1}. ${stop.name}${where ? ` (${where})` : ''}${driveText ? `, ${driveText}` : ''}${timeText ? `, ${timeText}` : ''}`
    );
  });
  if (lunch) lines.push(`Lunch break: ${lunch.start} to ${lunch.end}`);
  if (schedule?.endsAt) lines.push(`Planned finish: ${schedule.endsAt}`);
  if (schedule?.overrunMinutes > 0) {
    lines.push(`Note: this runs ${schedule.overrunMinutes} minutes past the intended finish.`);
  }
  lines.push('');
  lines.push('Please comment on this day and reply with the trip_plan JSON block.');
  return lines.join('\n');
}

/**
 * Validate the model's trip_plan block against the real stop count.
 * Returns { summary, stopNotes:[{ index (0-based), note }], tips } or null.
 */
export function parseTripPlan(value, stopCount) {
  if (!value || typeof value !== 'object') return null;
  const summary = typeof value.summary === 'string' ? softenDashes(value.summary.trim()).slice(0, 1200) : '';
  const seen = new Set();
  const stopNotes = [];
  if (Array.isArray(value.stop_notes)) {
    for (const entry of value.stop_notes) {
      const index = Number(entry?.index);
      const note = typeof entry?.note === 'string' ? entry.note.trim() : '';
      if (!Number.isInteger(index) || index < 1 || index > stopCount || !note || seen.has(index)) continue;
      seen.add(index);
      stopNotes.push({ index: index - 1, note: softenDashes(note).slice(0, 600) });
    }
    stopNotes.sort((a, b) => a.index - b.index);
  }
  const tips = Array.isArray(value.tips)
    ? value.tips.filter((tip) => typeof tip === 'string' && tip.trim()).map((tip) => softenDashes(tip.trim()).slice(0, 300)).slice(0, 4)
    : [];
  if (!summary && stopNotes.length === 0 && tips.length === 0) return null;
  return { summary, stopNotes, tips };
}
