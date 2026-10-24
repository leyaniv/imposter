import GameSettingsFields from '../components/GameSettingsFields';
import PlayerList from '../components/PlayerList';
import StickyActions from '../components/StickyActions';
import type { Settings } from '../game/types';
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
  return (
    <main className="screen">
      <div className="screen-body">
        <h1 className="heading">{he.setup.title}</h1>

        <section className="field">
          <h2 className="label">{he.setup.players(settings.players.length)}</h2>
          <p className="help">{he.setup.playersHelp}</p>
          <PlayerList players={settings.players} onChange={(players) => onChange({ players })} />
        </section>

        <GameSettingsFields
          settings={settings}
          playerCount={settings.players.length}
          allCategories={allCategories}
          words={{ fresh: freshWords, used: usedWords, onReset: onResetUsedWords }}
          onChange={onChange}
        />
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
