// מכניס הצעות מאושרות ל-src/data/words.he.json: כל מילה בסוף הקבוצה של הקטגוריה שלה,
// וקטגוריה שעוד לא קיימת נוספת כקבוצה חדשה בסוף הקובץ. אחר כך מריצים npm test.
// הרצה: node scripts/word-review/insert.mjs <proposals.json>
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = 'src/data/words.he.json';
const [proposalsFile] = process.argv.slice(2);
if (!proposalsFile) throw new Error('הרצה: node scripts/word-review/insert.mjs <proposals.json>');

const proposals = JSON.parse(readFileSync(proposalsFile, 'utf8'));
const text = readFileSync(FILE, 'utf8');
const eol = text.includes('\r\n') ? '\r\n' : '\n';
const lines = text.split(eol);
const q = (s) => JSON.stringify(s);
const isEntry = (l) => l.trimStart().startsWith('{ "category"');
const withComma = (l) => (l.trimEnd().endsWith(',') ? l : `${l},`);

for (const { name, entries } of proposals.categories) {
  const newLines = entries.map(
    ([word, ...hints]) => `  { "category": ${q(name)}, "word": ${q(word)}, "hints": [${hints.map(q).join(', ')}] },`,
  );
  let at = lines.findLastIndex((l) => l.includes(`"category": ${q(name)}`));
  if (at === -1) {
    at = lines.findLastIndex(isEntry);
    newLines.unshift('');
  }
  lines[at] = withComma(lines[at]);
  lines.splice(at + 1, 0, ...newLines);
}

// לרשומה האחרונה בקובץ אין פסיק
const last = lines.findLastIndex(isEntry);
lines[last] = lines[last].replace(/,\s*$/, '');

const result = lines.join(eol);
JSON.parse(result);
writeFileSync(FILE, result);
console.log(`נוספו ${proposals.categories.reduce((n, c) => n + c.entries.length, 0)} מילים ל-${FILE}`);
