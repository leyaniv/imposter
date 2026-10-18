import { useEffect, useState } from 'react';
import StickyActions from '../components/StickyActions';
import Stepper from '../components/Stepper';
import { MAX_PLAYERS, MIN_PLAYERS, MIN_PLAYERS_FOR_TWO_IMPOSTERS, maxImposters } from '../game/setup';
import type { Settings } from '../game/types';
import { toggleCategory } from '../game/words';
import { he } from '../i18n/he';

interface Props {
  settings: Settings;
  /** כל הקטגוריות במאגר, לפי הסדר */
  allCategories: string[];
  /** כמה מילים בקטגוריות שנבחרו עוד לא יצאו */
  freshWords: number;
  /** כמה מילים כבר יצאו (בכל הקטגוריות) */
  usedWords: number;
  onChange: (settings: Partial<Settings>) => void;
  onResetUsedWords: () => void;
  onBack: () => void;
  onStart: () => void;
}

export default function SetupScreen({
  settings,
  allCategories,
  freshWords,
  usedWords,
  onChange,
  onResetUsedWords,
  onBack,
  onStart,
}: Props) {
  const [justReset, setJustReset] = useState(false);

  useEffect(() => {
    if (!justReset) return;
    const timer = setTimeout(() => setJustReset(false), 3000);
    return () => clearTimeout(timer);
  }, [justReset]);

  const setName = (index: number, name: string) => {
    const names = [...settings.names];
    names[index] = name;
    onChange({ names });
  };

  const resetUsedWords = () => {
    onResetUsedWords();
    setJustReset(true);
  };

  const allSelected = settings.categories.length === 0;
  const isSelected = (category: string) => allSelected || settings.categories.includes(category);
  const twoAllowed = maxImposters(settings.playerCount) === 2;

  return (
    <main className="screen">
      <div className="screen-body">
        <h1 className="heading">{he.setup.title}</h1>

        <section className="field">
          <h2 className="label">{he.setup.playerCount}</h2>
          <Stepper
            value={settings.playerCount}
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            decreaseLabel={he.setup.fewer}
            increaseLabel={he.setup.more}
            onChange={(playerCount) => onChange({ playerCount })}
          />
        </section>

        <section className="field">
          <h2 className="label">{he.setup.names}</h2>
          <p className="help">{he.setup.namesHelp}</p>
          <ol className="name-list">
            {Array.from({ length: settings.playerCount }, (_, i) => (
              <li key={i}>
                <span className="name-index">{i + 1}</span>
                <input
                  className="input"
                  value={settings.names[i] ?? ''}
                  placeholder={he.playerFallback(i + 1)}
                  maxLength={16}
                  enterKeyHint="next"
                  autoComplete="off"
                  aria-label={he.playerFallback(i + 1)}
                  onChange={(e) => setName(i, e.target.value)}
                />
              </li>
            ))}
          </ol>
        </section>

        <section className="field">
          <div className="label-row">
            <h2 className="label">{he.setup.categories}</h2>
            <button
              className="link-btn"
              disabled={allSelected}
              onClick={() => onChange({ categories: [] })}
            >
              {he.setup.allCategories}
            </button>
          </div>
          <div className="label-row">
            <p className="help" aria-live="polite">
              {justReset ? he.setup.usedWordsReset : he.setup.freshWords(freshWords)}
            </p>
            {usedWords > 0 && (
              <button className="link-btn" aria-label={he.setup.resetUsedWordsLabel(usedWords)} onClick={resetUsedWords}>
                {he.setup.resetUsedWords}
              </button>
            )}
          </div>
          <div className="chips">
            {allCategories.map((category) => (
              <button
                key={category}
                className={`chip${isSelected(category) ? ' chip-on' : ''}`}
                aria-pressed={isSelected(category)}
                onClick={() => onChange({ categories: toggleCategory(allCategories, settings.categories, category) })}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

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
      </div>

      <StickyActions>
        <button className="btn btn-primary" onClick={onStart}>
          {he.setup.start}
        </button>
        <button className="btn btn-ghost" onClick={onBack}>
          {he.setup.back}
        </button>
      </StickyActions>
    </main>
  );
}
