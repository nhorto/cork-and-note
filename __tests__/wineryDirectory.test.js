// Distance math for the Near You row (lib/geo.js, used by lib/wineryDirectory.js).
import { haversineKm } from '../lib/geo';

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(38.9, -77.9, 38.9, -77.9)).toBe(0);
  });

  it('matches a known distance: DC to Richmond ≈ 155 km', () => {
    const km = haversineKm(38.9072, -77.0369, 37.5407, -77.436);
    expect(km).toBeGreaterThan(145);
    expect(km).toBeLessThan(165);
  });

  it('is symmetric', () => {
    const a = haversineKm(38.9, -77.9, 37.5, -77.4);
    const b = haversineKm(37.5, -77.4, 38.9, -77.9);
    expect(a).toBeCloseTo(b, 10);
  });
});
