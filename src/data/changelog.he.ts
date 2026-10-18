/** היסטוריית השינויים שמוצגת במסך "אודות". הגרסה החדשה ראשונה */
export interface ChangelogEntry {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  items: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '0.1.0',
    date: '2026-10-18',
    items: ['גרסה ראשונית'],
  },
];
