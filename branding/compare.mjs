// משווה גרסה קודמת של האייקון לנוכחית: לפני | אחרי
// הרצה: node branding/compare.mjs <path-to-before.svg> [שם-גרסה] [path-to-after.svg]
// בלי after משווים מול האייקון הנוכחי; עם after (למשל הלוגו המלא) מציגים רק בגודל גדול
// כל גרסה נשמרת בשם משלה, כדי שתצוגות לא יציגו עותק ישן מהמטמון
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const before = readFileSync(process.argv[2], 'utf8');
const afterPath = process.argv[4];
const after = readFileSync(afterPath ?? join(dir, 'mimi-icon.svg'), 'utf8');
const uri = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

const column = (label, svg) => `
  <figure>
    <figcaption>${label}</figcaption>
    <img src="${uri(svg)}" width="${afterPath ? 600 : 300}" alt="">${afterPath ? '' : `
    <div class="small"><img src="${uri(svg)}" width="64" height="64" alt=""><img src="${uri(svg)}" width="32" height="32" alt=""></div>`}
  </figure>`;

const name = process.argv[3] ?? 'latest';
mkdirSync(join(dir, 'compare'), { recursive: true });
const out = join(dir, 'compare', `compare-${name}.html`);
writeFileSync(out, `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>מימי – לפני ואחרי</title>
<style>
  body { margin: 0; padding: 24px 16px; background: #f5f2fb; font-family: system-ui, sans-serif; color: #13111c; }
  .pair { display: flex; gap: 24px; flex-wrap: wrap; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 10px; align-items: center; }
  figcaption { font-weight: 700; font-size: 18px; }
  img { max-width: 100%; height: auto; }
  .small { display: flex; gap: 12px; align-items: flex-end; background: #1e1a2b; padding: 12px; border-radius: 12px; }
</style>
</head>
<body>
  <div class="pair">${column('לפני', before)}${column('אחרי', after)}</div>
</body>
</html>
`);
console.log(`wrote branding/compare/compare-${name}.html`);
