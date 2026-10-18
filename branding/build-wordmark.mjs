// בונה את הלוגו המלא (אייקון + "מימיתחזה") מתוך mimi-icon.svg
// הרצה: node branding/build-wordmark.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const icon = readFileSync(join(dir, 'mimi-icon.svg'), 'utf8');
const inner = icon
  .replace(/^[\s\S]*?<svg[^>]*>/, '')
  .replace(/<\/svg>\s*$/, '')
  .replace(/<title>[\s\S]*?<\/title>/, '');

const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 420" width="1200" height="420">
  <title>מימיתחזה</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@500;900&amp;display=swap');
    .name { font-family: 'Heebo', Arial, sans-serif; font-weight: 900; font-size: 132px; }
    .tag { font-family: 'Heebo', Arial, sans-serif; font-weight: 500; font-size: 46px; fill: #a49cbc; }
  </style>
  <rect width="1200" height="420" rx="56" fill="#13111c"/>
  <svg x="800" y="50" width="320" height="320" viewBox="0 0 512 512">${inner}</svg>
  <text x="750" y="214" direction="rtl" text-anchor="start" class="name"><tspan fill="#ff4d6d">מי</tspan><tspan fill="#ff9aae">מי</tspan><tspan fill="#f5f2fb">תחזה</tspan></text>
  <text x="750" y="296" direction="rtl" text-anchor="start" class="tag">משחק מתחזה בעברית</text>
</svg>
`;

writeFileSync(join(dir, 'mimi-wordmark.svg'), wordmark);
console.log('wrote branding/mimi-wordmark.svg');

// עמוד תצוגה עצמאי (ה-SVG מוטמעים בתוכו)
const uri = (svg) => 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
const preview = readFileSync(join(dir, 'preview.template.html'), 'utf8')
  .replaceAll('src="mimi-icon.svg"', `src="${uri(icon)}"`)
  .replace(/<object[^>]*><\/object>/, wordmark.replace('<svg ', '<svg class="wordmark" '));
writeFileSync(join(dir, 'preview.html'), preview);
console.log('wrote branding/preview.html');
