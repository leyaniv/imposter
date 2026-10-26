// בונה את דף הסקירה הלחיץ למילים חדשות מתוך קובץ הצעות (ראו src/data/AGENTS.md).
// הרצה: node scripts/word-review/build.mjs <proposals.json> <out.html>
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const [proposalsFile, out] = process.argv.slice(2);
if (!proposalsFile || !out) throw new Error('הרצה: node scripts/word-review/build.mjs <proposals.json> <out.html>');

const proposals = JSON.parse(readFileSync(proposalsFile, 'utf8'));
// המפתח הוא חלק ממזהה הסימון שנשמר בדף (למשל transport-01), אז לא משנים אותו באמצע סקירה
const categories = proposals.categories.map((c, i) => ({
  key: c.key || `c${i + 1}`,
  name: c.name,
  notes: c.notes || [],
  entries: c.entries,
  changed: c.changed || {},
}));
for (const c of categories) {
  if (!/^[A-Za-z0-9_-]+$/.test(c.key)) throw new Error(`מפתח קטגוריה לא תקין: ${c.key}`);
  for (const e of c.entries) if (e.length !== 4) throw new Error(`צריך מילה ושלושה רמזים: ${e.join(', ')}`);
}

const escape = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const names = categories.map((c) => c.name);
const heading = names.length > 1 ? `${names.slice(0, -1).join(', ')} ו${names.at(-1)}` : names[0];
const count = categories.reduce((n, c) => n + c.entries.length, 0);
const json = JSON.stringify(categories).replace(/</g, '\\u003c');

const html = readFileSync(join(dir, 'template.html'), 'utf8')
  .replace('{{TITLE}}', () => escape(proposals.title || 'סקירת מילים חדשות'))
  .replace('{{HEADING}}', () => escape(heading))
  .replace('{{COUNT}}', () => String(count))
  .replace('/*DATA*/null', () => json);
writeFileSync(out, html);
console.log(`נבנה ${out}: ${categories.map((c) => `${c.name} (${c.entries.length})`).join(', ')}`);
