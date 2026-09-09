// lib/exportTastings.js — "Export (CSV of tastings)", the Pro-only line in the
// launch plan's §4.2 tier table.
//
// The point of this feature is that the journal is the user's, not ours: a
// subscription they can walk away from with their data is an easier thing to buy.
// So the shape below is deliberately spreadsheet-plain — one row per wine tasted,
// every visit column repeated — rather than a nested export that needs our app to
// read back.
//
// The CSV building is pure and tested; only shareTastingsCsv() touches the device.
import * as FileSystem from 'expo-file-system';
import { Platform, Share } from 'react-native';
import { varietalText } from './varietals';
import { visitsService } from './visits';

export const CSV_COLUMNS = [
  'Date',
  'Winery',
  'Address',
  'Wine',
  'Producer',
  'Vintage',
  'Type',
  'Varietals',
  'Rating',
  'Sweetness',
  'Tannin',
  'Acidity',
  'Body',
  'Alcohol',
  'Flavor notes',
  'Wine notes',
  'Visit notes',
];

/**
 * Quote a single CSV field.
 *
 * Tasting notes are free text and routinely contain commas, quotes and newlines,
 * any one of which silently corrupts an unquoted file. Quoting everything is a
 * few bytes larger and always correct, so it is what we do.
 */
export function csvEscape(value) {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** Flavor notes arrive as a nested join; flatten them to "Cherry; Oak; Vanilla". */
function flavorNoteText(wine) {
  const notes = Array.isArray(wine?.wine_flavor_notes) ? wine.wine_flavor_notes : [];
  const names = notes
    .map((entry) => entry?.flavor_notes?.name)
    .filter((name) => typeof name === 'string' && name.trim());
  return names.join('; ');
}

/**
 * One row per wine. A visit logged with no wines still gets a row, because a
 * winery visit with only notes is a real entry in the journal and dropping it
 * would make the export quietly lossy.
 */
export function visitsToRows(visits) {
  const rows = [];
  for (const visit of Array.isArray(visits) ? visits : []) {
    if (!visit) continue;
    const base = [
      visit.visit_date ?? '',
      visit.wineries?.name ?? '',
      visit.wineries?.address ?? '',
    ];
    const wines = Array.isArray(visit.wines) ? visit.wines : [];

    if (wines.length === 0) {
      rows.push([...base, '', '', '', '', '', '', '', '', '', '', '', '', '', visit.notes ?? '']);
      continue;
    }

    for (const wine of wines) {
      rows.push([
        ...base,
        wine?.wine_name ?? '',
        wine?.winemaker ?? '',
        wine?.wine_year ?? '',
        wine?.wine_type ?? '',
        varietalText(wine?.wine_varietal) ?? '',
        wine?.overall_rating ?? '',
        wine?.sweetness ?? '',
        wine?.tannin ?? '',
        wine?.acidity ?? '',
        wine?.body ?? '',
        wine?.alcohol ?? '',
        flavorNoteText(wine),
        wine?.additional_notes ?? '',
        visit.notes ?? '',
      ]);
    }
  }
  return rows;
}

/**
 * The whole file. CRLF line endings and a UTF-8 BOM, both for Excel's sake: it
 * mis-detects LF-only files and mangles accented producer names without the BOM,
 * and a wine export full of mangled Chateaux is worse than no export.
 */
export function toCsv(visits) {
  const lines = [CSV_COLUMNS, ...visitsToRows(visits)].map((row) =>
    row.map(csvEscape).join(',')
  );
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

/** `cork-and-note-tastings-2026-09-08.csv` */
export function exportFileName(date = new Date()) {
  return `cork-and-note-tastings-${date.toISOString().slice(0, 10)}.csv`;
}

/**
 * Fetch, build and hand the file to the OS share sheet ("Save to Files", Mail,
 * AirDrop). Returns { success, error, rowCount } — the caller reports it.
 */
export async function shareTastingsCsv() {
  const result = await visitsService.getUserVisits();
  if (!result?.success) {
    return { success: false, error: result?.error || 'Could not load your tastings.' };
  }

  const rowCount = visitsToRows(result.visits).length;
  if (rowCount === 0) {
    return { success: false, error: 'You have no tastings to export yet.' };
  }

  try {
    const uri = `${FileSystem.cacheDirectory}${exportFileName()}`;
    await FileSystem.writeAsStringAsync(uri, toCsv(result.visits), {
      encoding: FileSystem.EncodingType.UTF8,
    });
    // iOS is the launch platform and hands a file url straight to the share
    // sheet ("Save to Files", Mail, AirDrop). Android's Share has no file
    // channel, so it gets the CSV inline rather than nothing at all.
    await Share.share(
      Platform.OS === 'ios'
        ? { url: uri, title: 'Cork & Note tastings' }
        : { message: toCsv(result.visits), title: 'Cork & Note tastings' }
    );
    return { success: true, rowCount };
  } catch (error) {
    console.error('CSV export failed:', error);
    return { success: false, error: error?.message || 'Could not create the export file.' };
  }
}
