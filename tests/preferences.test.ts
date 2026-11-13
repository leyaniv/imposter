import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, parsePreferences } from '../src/ui/preferences';

describe('parsePreferences', () => {
  it('starts dark, with sound and vibration on', () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES.theme).toBe('dark');
  });

  it('keeps saved choices', () => {
    const saved = { theme: 'light', sound: false, vibration: false, textSize: 'large', reduceMotion: true };
    expect(parsePreferences(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('falls back to the default for each broken or unknown value', () => {
    expect(parsePreferences({ theme: 'pink', sound: 'no', textSize: 3, reduceMotion: null })).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences('garbage')).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps a phone muted from the old mute button in the room', () => {
    expect(parsePreferences(null, true).sound).toBe(false);
    // אחרי שבחרו בהגדרות, הבחירה החדשה קובעת
    expect(parsePreferences({ sound: true }, true).sound).toBe(true);
  });
});
