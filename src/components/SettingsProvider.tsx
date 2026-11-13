import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { track } from '../analytics/posthog';
import { useBackGuard } from '../hooks/useBackGuard';
import SettingsSheet from './SettingsSheet';

/** מאיפה פתחו את ההגדרות, לטלמטריה */
export type SettingsFrom = 'home' | 'game';

const OpenSettings = createContext<((from: SettingsFrom) => void) | null>(null);

/** פותח את חלון ההגדרות */
export function useOpenSettings() {
  return useContext(OpenSettings);
}

/**
 * חלון ההגדרות נפתח מעל המסך הנוכחי ולא במקומו:
 * כך סבב באמצע לא הולך לאיבוד, והחיבור לחדר המקוון נשאר פתוח.
 */
export default function SettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const openSettings = useCallback((from: SettingsFrom) => {
    setOpen(true);
    track('settings_open', { from });
  }, []);

  useBackGuard(open, close);

  return (
    <OpenSettings.Provider value={openSettings}>
      {children}
      {open && <SettingsSheet onClose={close} />}
    </OpenSettings.Provider>
  );
}
