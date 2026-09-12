// hooks/useAchievementCelebration.js — run the badge check after a save and,
// if something was earned, show the sheet (#296).
//
// Every screen that can earn a badge calls `check()` at the end of its save or
// focus load and renders `sheet`. The hook swallows everything: a badge is a
// garnish, and a failure here must never surface as an error on a screen whose
// actual job (saving a tasting, adding a bottle) succeeded.
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import AchievementSheet from '../components/AchievementSheet';
import { refreshAchievements } from '../lib/achievements';
import { levelForPoints } from '../lib/achievements/catalog';
import { getCelebrationPref } from '../lib/achievements/prefs';

export function useAchievementCelebration() {
  const router = useRouter();
  const [state, setState] = useState(null); // { awards, level, levelUp, backfill }
  // Guards a second check() landing while the first is still running, which
  // would otherwise double insert nothing but still flash two sheets.
  const running = useRef(false);

  const close = useCallback(() => setState(null), []);

  const check = useCallback(async () => {
    if (running.current) return null;
    running.current = true;
    try {
      const res = await refreshAchievements();
      if (!res?.success || !res.newlyEarned?.length) return res ?? null;

      const celebrate = await getCelebrationPref();
      // Badges still land in the collection when celebrations are off; the
      // user only opted out of the interruption.
      if (celebrate) {
        const level = res.result?.level ?? null;
        // Where the user stood before this batch landed, so "Level up" is only
        // claimed when the batch actually crossed a boundary.
        const pointsBefore = (res.earnedRows || []).reduce(
          (sum, r) => sum + (Number(r.points) || 0), 0
        );
        const before = levelForPoints(pointsBefore);
        setState({
          awards: res.newlyEarned,
          level,
          levelUp: level && level.level > before.level ? before : null,
          backfill: Boolean(res.backfill),
        });
      }
      return res;
    } catch (e) {
      console.warn('Achievement check failed:', e?.message);
      return null;
    } finally {
      running.current = false;
    }
  }, []);

  const sheet = (
    <AchievementSheet
      visible={Boolean(state)}
      awards={state?.awards || []}
      level={state?.level || null}
      levelUp={state?.levelUp || null}
      backfill={Boolean(state?.backfill)}
      onClose={close}
      onViewCollection={() => {
        close();
        router.push('/profile/achievements');
      }}
    />
  );

  return { check, sheet, close };
}
