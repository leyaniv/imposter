import { useEffect, useState } from 'react';
import { MIN_PLAYERS_FOR_TWO_IMPOSTERS, maxImposters } from '../game/setup';
import type { Settings } from '../game/types';
import { he } from '../i18n/he';
import CategoryPicker from './CategoryPicker';

export type GameSettings = Omit<Settings, 'players'>;

/** כמה מילים נשארו, ואיפוס. רק במצב הטלפון האחד, שבו ההיסטוריה שמורה בטלפון */
interface WordsInfo {
  /** כמה מילים בקטגוריות שנבחרו עוד לא יצאו */
  fresh: number;
  /** כמה מילים כבר יצאו (בכל הקטגוריות) */
  used: number;
  onReset: () => void;
}

interface Props {
  settings: GameSettings;
  playerCount: number;
  /** כל הקטגוריות במאגר, לפי הסדר */
  allCategories: string[];
  words?: WordsInfo;
  onChange: (settings: Partial<GameSettings>) => void;
}

/** ההגדרות של המשחק (בלי השחקנים): קטגוריות, מספר מתחזים, ומי רואה מה. משותף למסך ההגדרות וללובי */
export default function GameSettingsFields({ settings, playerCount, allCategories, words, onChange }: Props) {
  const [justReset, setJustReset] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!justReset) return;
    const timer = setTimeout(() => setJustReset(false), 3000);
    return () => clearTimeout(timer);
  }, [justReset]);

  const resetUsedWords = () => {
    words?.onReset();
    setJustReset(true);
  };

  const allSelected = settings.categories.length === 0;
  // לפי הסדר במאגר, ובלי קטגוריות שכבר לא קיימות
  const chosen = allCategories.filter((category) => settings.categories.includes(category));
  const twoAllowed = maxImposters(playerCount) === 2;

  return (
    <>
      <section className="field">
        <h2 className="label">{he.setup.categories}</h2>
        <div className="segmented" role="radiogroup" aria-label={he.setup.categories}>
          <button
            role="radio"
            aria-checked={allSelected}
            className={`segment${allSelected ? ' segment-on' : ''}`}
            onClick={() => onChange({ categories: [] })}
          >
            {he.setup.categoriesAll}
          </button>
          <button
            role="radio"
            aria-checked={!allSelected}
            className={`segment${allSelected ? '' : ' segment-on'}`}
            onClick={() => setPicking(true)}
          >
            {he.setup.categoriesCustom}
          </button>
        </div>
        {!allSelected && (
          <div className="label-row">
            <p className="help">{he.setup.categoriesChosen(chosen)}</p>
            <button className="link-btn" onClick={() => setPicking(true)}>
              {he.setup.categoriesEdit}
            </button>
          </div>
        )}
        {words && (
          <div className="label-row">
            <p className="help" aria-live="polite">
              {justReset ? he.setup.usedWordsReset : he.setup.freshWords(words.fresh)}
            </p>
            {words.used > 0 && (
              <button className="link-btn" aria-label={he.setup.resetUsedWordsLabel(words.used)} onClick={resetUsedWords}>
                {he.setup.resetUsedWords}
              </button>
            )}
          </div>
        )}
      </section>

      {picking && (
        <CategoryPicker
          allCategories={allCategories}
          selected={settings.categories}
          onChange={(categories) => onChange({ categories })}
          onClose={() => setPicking(false)}
        />
      )}

      <section className="field">
        <h2 className="label">{he.setup.imposterCount}</h2>
        <div className="segmented" role="radiogroup" aria-label={he.setup.imposterCount}>
          {([1, 2] as const).map((count) => (
            <button
              key={count}
              role="radio"
              aria-checked={settings.imposterCount === count}
              className={`segment${settings.imposterCount === count ? ' segment-on' : ''}`}
              disabled={count === 2 && !twoAllowed}
              onClick={() => onChange({ imposterCount: count })}
            >
              {he.setup.imposters(count)}
            </button>
          ))}
        </div>
        <p className="help">
          {twoAllowed ? he.setup.twoImpostersHelp : he.setup.twoImpostersFrom(MIN_PLAYERS_FOR_TWO_IMPOSTERS)}
        </p>
      </section>

      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.imposterNeverStarts}
          onChange={(e) => onChange({ imposterNeverStarts: e.target.checked })}
        />
        <span>{he.setup.imposterNeverStarts}</span>
      </label>

      <div className="field">
        <label className="toggle">
          <input
            type="checkbox"
            checked={settings.showCategory}
            onChange={(e) => onChange({ showCategory: e.target.checked })}
          />
          <span>{he.setup.showCategory}</span>
        </label>
        <p className="help">{he.setup.showCategoryHelp}</p>
      </div>
    </>
  );
}
