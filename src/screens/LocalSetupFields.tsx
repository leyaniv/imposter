import GameSettingsFields from '../components/GameSettingsFields';
import PlayerList from '../components/PlayerList';
import type { Settings } from '../game/types';
import { he } from '../i18n/he';

/** מה שהמשחק המקומי צריך כדי להציג ולשנות את ההגדרות, גם מתוך חדר מקוון פתוח */
export interface LocalSetup {
  settings: Settings;
  /** כל הקטגוריות במאגר, לפי הסדר */
  allCategories: string[];
  /** כמה מילים בקטגוריות שנבחרו עוד לא יצאו */
  freshWords: number;
  /** כמה מילים כבר יצאו (בכל הקטגוריות) */
  usedWords: number;
  onChange: (settings: Partial<Settings>) => void;
  onResetUsedWords: () => void;
  /** מחלק תפקידים ומתחיל סבב מקומי */
  onStart: () => void;
}

/** משחק מקומי: השחקנים לפי סדר הישיבה, וההגדרות */
export default function LocalSetupFields({ local }: { local: LocalSetup }) {
  const { settings } = local;
  return (
    <>
      <section className="field">
        <h2 className="label">{he.setup.players(settings.players.length)}</h2>
        <p className="help">{he.setup.playersHelp}</p>
        <PlayerList players={settings.players} onChange={(players) => local.onChange({ players })} />
      </section>

      <GameSettingsFields
        settings={settings}
        playerCount={settings.players.length}
        allCategories={local.allCategories}
        words={{ fresh: local.freshWords, used: local.usedWords, onReset: local.onResetUsedWords }}
        onChange={local.onChange}
      />
    </>
  );
}
