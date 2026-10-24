import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/heebo/hebrew-400.css';
import '@fontsource/heebo/hebrew-600.css';
import '@fontsource/heebo/hebrew-800.css';
import '@fontsource/heebo/latin-400.css';
import '@fontsource/heebo/latin-600.css';
import '@fontsource/heebo/latin-800.css';
import { initAnalytics } from './analytics/posthog';
import App from './App';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './styles/global.css';

registerServiceWorker();
initAnalytics();

// מצב "כל אחד בטלפון שלו" עוד בבנייה: נכנסים אליו רק מקישור עם ?online או ?room=<קוד>.
// נטען בנפרד, כדי לא להאט את מצב הטלפון האחד
const OnlineApp = lazy(() => import('./online/OnlineApp'));
const params = new URLSearchParams(location.search);
const online = params.has('online') || params.has('room');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {online ? (
      <Suspense fallback={null}>
        <OnlineApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
