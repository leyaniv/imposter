interface ImportMetaEnv {
  /** Project API key של PostHog (מתחיל ב-phc_). בלי זה לא נשלחת טלמטריה */
  readonly VITE_POSTHOG_KEY?: string;
  /** https://us.i.posthog.com או https://eu.i.posthog.com, לפי האזור של הפרויקט */
  readonly VITE_POSTHOG_HOST?: string;
}

/** מספר הגרסה מ-package.json (מוגדר ב-vite.config.ts) */
declare const __APP_VERSION__: string;
