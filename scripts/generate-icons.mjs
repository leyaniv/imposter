// יוצר את אייקוני האפליקציה מהאייקון של מימי (branding/mimi-icon.svg). מריצים אחרי כל שינוי בו, והתוצאות נשמרות ב-public/.
//   npm run icons
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const SOURCE = readFileSync('branding/mimi-icon.svg', 'utf8');

// האייקון בנוי מ-defs, מלבן רקע עם פינות מעוגלות, ואחריו הציור עצמו
const BG_RECT = /<rect width="512" height="512" rx="112" fill="url\(#bg\)"\/>/;
if (!BG_RECT.test(SOURCE)) throw new Error('לא נמצא מלבן הרקע ב-branding/mimi-icon.svg');
const [head, rest] = SOURCE.split(BG_RECT);
const art = rest.replace(/<\/svg>\s*$/, '');

/**
 * @param {object} o
 * @param {number} o.radius  עיגול פינות הרקע (0 = ריבוע מלא, בשביל maskable ו-iOS)
 * @param {number} o.scale   גודל הציור ביחס לאייקון המקורי
 */
function iconSvg({ radius, scale }) {
  const art_ = scale === 1 ? art : `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${art}</g>`;
  return `${head}<rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>${art_}</svg>\n`;
}

/** רק הפרצוף של מימי, בלי רקע וזוהר, חתוך סביב האוזניים והסנטר. בשביל הלוגו במסך הבית */
function faceSvg() {
  const glow = /<circle cx="256" cy="290" r="230" fill="url\(#glow\)"\/>/;
  if (!glow.test(art)) throw new Error('לא נמצא הזוהר ב-branding/mimi-icon.svg');
  const face = head.replace(/<svg[^>]*>/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="50 84 412 352">');
  return `${face}${art.replace(glow, '')}</svg>\n`;
}

function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

mkdirSync('public/icons', { recursive: true });

const regular = iconSvg({ radius: 112, scale: 1 });
// maskable: אנדרואיד חותך את האייקון לצורות שונות, אז הרקע מלא ומימי כולה בתוך 80% האמצעיים
const maskable = iconSvg({ radius: 0, scale: 0.74 });
// iOS מעגל את הפינות בעצמו, אז הרקע מלא, ומשאירים קצת שוליים לאוזניים ולשפמים
const apple = iconSvg({ radius: 0, scale: 0.9 });

writeFileSync('public/favicon.svg', regular);
writeFileSync('public/mimi-face.svg', faceSvg());
writeFileSync('public/icons/icon-192.png', png(regular, 192));
writeFileSync('public/icons/icon-512.png', png(regular, 512));
writeFileSync('public/icons/maskable-512.png', png(maskable, 512));
writeFileSync('public/icons/apple-touch-icon.png', png(apple, 180));

console.log('icons written to public/');
