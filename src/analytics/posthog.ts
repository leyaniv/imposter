/**
 * טלמטריה דרך PostHog.
 * דפדפן, מערכת הפעלה, סוג מכשיר, מדינה ומשך ביקור נאספים אוטומטית.
 * פועל רק כשמוגדר VITE_POSTHOG_KEY (ב-.env.production), כך שבפיתוח לא נשלח כלום.
 * כדי לא לספור את עצמך: localStorage.setItem('analytics.disabled', '1') בדפדפן.
 */
import type { PostHog } from 'posthog-js';

type EventValue = string | number | boolean;
export type EventData = Record<string, EventValue>;

const KEY: string | undefined = import.meta.env.VITE_POSTHOG_KEY;
const HOST: string = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

let client: PostHog | undefined;
/** אירועים שנשלחו לפני שהספרייה סיימה להיטען */
const queue: [string, EventData | undefined][] = [];

function disabledOnThisDevice(): boolean {
  try {
    return localStorage.getItem('analytics.disabled') === '1';
  } catch {
    return false;
  }
}

export function initAnalytics() {
  if (!KEY || disabledOnThisDevice()) return;
  // נטען בנפרד, כדי לא להאט את פתיחת המשחק
  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        defaults: '2026-05-30',
        // מזהה אנונימי ב-localStorage (לא עוגייה), כדי לדעת מי חוזר לשחק
        persistence: 'localStorage',
        person_profiles: 'identified_only',
        capture_pageview: true,
        capture_pageleave: true,
        // רק האירועים שאנחנו שולחים, בלי הקלטות, קליקים אוטומטיים וסקריפטים נוספים
        autocapture: false,
        rageclick: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_product_tours: true,
        disable_conversations: true,
        disable_web_experiments: true,
        disable_external_dependency_loading: true,
        advanced_disable_feature_flags: true,
      });
      client = posthog;
      for (const [name, data] of queue.splice(0)) client.capture(name, data);
    })
    .catch(() => {
      // טלמטריה לעולם לא שוברת את המשחק
    });
}

export function track(name: string, data?: EventData) {
  if (import.meta.env.DEV) console.debug('[analytics]', name, data ?? '');
  if (!KEY) return;
  try {
    if (client) client.capture(name, data);
    else if (queue.length < 50) queue.push([name, data]);
  } catch {
    // טלמטריה לעולם לא שוברת את המשחק
  }
}
