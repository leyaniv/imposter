import { useSyncExternalStore } from 'react';
import { getPreferences, subscribePreferences, type Preferences } from '../ui/preferences';

/** ההעדפות של הטלפון הזה, ומתעדכן בכל שינוי (למשל השתקה מהחלון וגם מהכפתור בחדר) */
export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribePreferences, getPreferences);
}
