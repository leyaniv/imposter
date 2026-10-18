import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/** כל הקבצים בתיקייה, כולל תת-תיקיות */
function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/**
 * אחרי ה-build: כותב dist/sw.js עם רשימת כל הקבצים לשמירה במכשיר.
 * הגרסה היא hash של תוכן הקבצים, כך שכל שינוי יוצר service worker חדש.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'imposter-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = listFiles(outDir)
        .map((file) => relative(outDir, file).replaceAll('\\', '/'))
        // woff ישן נטען רק בדפדפנים בלי woff2, אין טעם לשמור אותו
        .filter((file) => file !== 'sw.js' && !file.endsWith('.woff'))
        .sort();

      const template = readFileSync(resolve(import.meta.dirname, 'src/pwa/sw.template.js'), 'utf8');

      const hash = createHash('sha256').update(template);
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)));
      const version = hash.digest('hex').slice(0, 12);
      const sw = template
        .replace('__VERSION__', version)
        .replace('__ASSETS__', JSON.stringify(['./', ...files.map((file) => `./${file}`)], null, 2));
      writeFileSync(join(outDir, 'sw.js'), sw);
    },
  };
}

export default defineConfig({
  // נתיבים יחסיים, כדי שהאתר יעבוד גם בתת-תיקייה (למשל GitHub Pages)
  base: './',
  plugins: [react(), serviceWorker()],
  server: {
    // פתוח לרשת המקומית כדי שאפשר יהיה להיכנס מהטלפון
    host: true,
    port: 5180,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 5181,
    strictPort: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
