import { useEffect, useReducer } from 'react';
import { rehydrate, serialize } from '../game/persistence';
import { reducer } from '../game/reducer';
import type { AppState } from '../game/types';

const STORAGE_KEY = 'imposter:state';

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return rehydrate(raw ? JSON.parse(raw) : null);
  } catch {
    return rehydrate(null);
  }
}

/** ה-reducer של המשחק, עם שמירה ב-localStorage ושחזור אחרי ריענון */
export function usePersistentReducer() {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(state)));
    } catch {
      // גלישה פרטית או אחסון חסום: המשחק עובד גם בלי שמירה
    }
  }, [state]);

  return [state, dispatch] as const;
}
