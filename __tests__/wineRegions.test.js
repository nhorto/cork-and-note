// Unit tests for lib/wineRegions.js (#88). Two jobs here.
//
// The integrity block is the guard rail on a hand-maintained list: it is the
// only thing standing between a fat-fingered parent name and a region that
// silently resolves to nowhere. It asserts shape, never contents.
//
// The lookup block pins the behaviour the autocomplete and the write-time
// normalisation depend on — what counts as "the same place", and how far we are
// willing to go to recognise one.
import {
  WINE_REGIONS,
  findRegion,
  regionCountry,
  regionKey,
  regionPath,
  regionSubtitle,
  stripAppellationSuffix,
} from '../lib/wineRegions';

const byName = new Map(WINE_REGIONS.map((r) => [r.name, r]));

describe('the reference list itself', () => {
  it('gives every region a parent that exists, or none at all', () => {
    const orphans = WINE_REGIONS.filter((r) => r.parent && !byName.has(r.parent));
    expect(orphans).toEqual([]);
  });

  it('has no two regions sharing a name or an alias', () => {
    const seen = new Map(); // lookup key -> region name that claimed it
    const clashes = [];
    for (const region of WINE_REGIONS) {
      for (const label of [region.name, ...region.aliases]) {
        const key = regionKey(label);
        const owner = seen.get(key);
        if (owner && owner !== region.name) clashes.push(`${label}: ${owner} vs ${region.name}`);
        else seen.set(key, region.name);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('resolves every region up to a country, with no cycles', () => {
    const stranded = WINE_REGIONS.filter((r) => {
      const path = regionPath(r.name);
      return path.length === 0 || path[path.length - 1].parent !== null;
    });
    expect(stranded).toEqual([]);
  });

  it("covers Virginia's AVAs in full, since that is the launch region", () => {
    const virginia = WINE_REGIONS.filter((r) => r.parent === 'Virginia').map((r) => r.name);
    expect(virginia.sort()).toEqual(
      [
        'Appalachian High Country',
        'Middleburg Virginia',
        'Monticello',
        'North Fork of Roanoke',
        'Northern Neck George Washington Birthplace',
        'Rocky Knob',
        'Shenandoah Valley',
        "Virginia's Eastern Shore",
        'Virginia Peninsula',
      ].sort()
    );
    // Plus the statewide appellation a multi-AVA blend carries.
    expect(byName.get('Virginia').parent).toBe('United States');
  });

  it('covers the regions people actually log, across both hemispheres', () => {
    for (const name of [
      'Napa Valley', 'Willamette Valley', 'Finger Lakes', 'Paso Robles', 'Texas Hill Country',
      'Bordeaux', 'Burgundy', 'Champagne', 'Rioja', 'Tuscany', 'Barolo', 'Douro', 'Mosel',
      'Marlborough', 'Mendoza', 'Barossa Valley', 'Stellenbosch',
    ]) {
      expect(findRegion(name)?.name).toBe(name);
    }
    // The two Shenandoah Valleys are different places and stay distinct.
    expect(regionCountry('Shenandoah Valley')).toBe('United States');
    expect(regionPath('Shenandoah Valley')[1].name).toBe('Virginia');
    expect(regionPath('California Shenandoah Valley')[1].name).toBe('Sierra Foothills');
  });
});

describe('findRegion', () => {
  it('ignores case, accents and punctuation, so a phone keyboard is enough', () => {
    expect(findRegion('NAPA VALLEY').name).toBe('Napa Valley');
    expect(findRegion('cote rotie').name).toBe('Côte-Rôtie');
    expect(findRegion('Chateauneuf du Pape').name).toBe('Châteauneuf-du-Pape');
    expect(findRegion('rias baixas').name).toBe('Rías Baixas');
    expect(findRegion('st helena').name).toBe('St. Helena');
  });

  it('matches an alias to its region', () => {
    expect(findRegion('Sherry').name).toBe('Jerez');
    expect(findRegion('Amarone').name).toBe('Amarone della Valpolicella');
    expect(findRegion('Bourgogne').name).toBe('Burgundy');
    expect(findRegion('VA').name).toBe('Virginia');
  });

  it('sees through an appellation tier or a trailing country', () => {
    expect(findRegion('Barolo DOCG').name).toBe('Barolo');
    expect(findRegion('Monticello AVA').name).toBe('Monticello');
    expect(findRegion('Pauillac AOC').name).toBe('Pauillac');
    expect(findRegion('Napa Valley, California').name).toBe('Napa Valley');
    expect(findRegion('Monticello AVA, Virginia').name).toBe('Monticello');
  });

  it('returns null rather than guessing at something it does not know', () => {
    expect(findRegion('Honah Lee')).toBeNull();
    expect(findRegion('Gordonsville')).toBeNull();
    expect(findRegion('')).toBeNull();
    expect(findRegion(null)).toBeNull();
  });
});

describe('parent resolution', () => {
  it('walks an AVA all the way up to its country', () => {
    expect(regionPath('Oakville').map((r) => r.name)).toEqual([
      'Oakville',
      'Napa Valley',
      'North Coast',
      'California',
      'United States',
    ]);
    expect(regionPath('Pauillac').map((r) => r.name)).toEqual([
      'Pauillac',
      'Haut-Médoc',
      'Médoc',
      'Bordeaux',
      'France',
    ]);
  });

  it('answers the question the Virginia case actually asks', () => {
    // A producer's estate wine says Monticello and its blend says Virginia.
    // Different regions, correctly — but now they are visibly related.
    expect(regionCountry('Monticello')).toBe('United States');
    expect(regionPath('Monticello')[1].name).toBe('Virginia');
    expect(regionSubtitle('Monticello')).toBe('Virginia · United States');
    expect(regionSubtitle('Virginia')).toBe('United States');
  });

  it('has nothing to say about a region it does not know', () => {
    expect(regionPath('Somewhere Else')).toEqual([]);
    expect(regionCountry('Somewhere Else')).toBeNull();
    expect(regionSubtitle('Somewhere Else')).toBeNull();
  });

  it('leaves a country at the top of its own path', () => {
    expect(regionPath('France').map((r) => r.name)).toEqual(['France']);
    expect(regionCountry('France')).toBe('France');
    expect(regionSubtitle('France')).toBeNull();
  });
});

describe('stripAppellationSuffix', () => {
  it('drops the tier but never the name', () => {
    expect(stripAppellationSuffix('Chianti Classico DOCG')).toBe('Chianti Classico');
    expect(stripAppellationSuffix('Rioja DOCa')).toBe('Rioja');
    expect(stripAppellationSuffix('AVA')).toBe('AVA');
    expect(stripAppellationSuffix('Napa Valley')).toBe('Napa Valley');
  });
});
