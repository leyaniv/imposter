import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/heebo/hebrew-400.css';
import '@fontsource/heebo/hebrew-600.css';
import '@fontsource/heebo/hebrew-800.css';
import '@fontsource/heebo/latin-400.css';
import '@fontsource/heebo/latin-600.css';
import '@fontsource/heebo/latin-800.css';
import { initAnalytics } from './analytics/posthog';
import App from './App';
import OnlineApp from './online/OnlineApp';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './styles/global.css';

registerServiceWorker();
initAnalytics();

// מצב "כל אחד בטלפון שלו": נכנסים אליו מהכפתור במסך הבית (?online) או מקישור לחדר (?room=<קוד>).
// הוא חלק מהקובץ הראשי ולא נטען בנפרד (רק כ-4KB): טעינה נפרדת שנכשלת ברשת סלולרית משאירה מסך ריק
const params = new URLSearchParams(location.search);
const online = params.has('online') || params.has('room');

createRoot(document.getElementById('root')!).render(<StrictMode>{online ? <OnlineApp /> : <App />}</StrictMode>);
