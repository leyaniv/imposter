import { useEffect, useRef } from 'react';
import { toggleCategory } from '../game/words';
import { he } from '../i18n/he';

interface Props {
  /** כל הקטגוריות במאגר, לפי הסדר */
  allCategories: string[];
  /** ריק = כל הקטגוריות */
  selected: string[];
  onChange: (categories: string[]) => void;
  onClose: () => void;
}

/**
 * חלון לבחירת קטגוריות מסוימות. במסך עצמו יש רק "הכל" / "מותאם אישית",
 * כדי שהרשימה (שתגדל עם הזמן) לא תמלא את כל מסך ההכנה
 */
export default function CategoryPicker({ allCategories, selected, onChange, onClose }: Props) {
  const doneRef = useRef<HTMLButtonElement>(null);
  const allSelected = selected.length === 0;
  const isSelected = (category: string) => allSelected || selected.includes(category);

  useEffect(() => {
    doneRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog category-picker"
        role="dialog"
        aria-modal="true"
        aria-label={he.setup.categoriesPick}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="dialog-text">{he.setup.categoriesPick}</p>
        <p className="help">{he.setup.categoriesPickHelp}</p>
        <div className="chips category-picker-chips">
          {allCategories.map((category) => (
            <button
              key={category}
              className={`chip${isSelected(category) ? ' chip-on' : ''}`}
              aria-pressed={isSelected(category)}
              onClick={() => onChange(toggleCategory(allCategories, selected, category))}
            >
              {category}
            </button>
          ))}
        </div>
        <button ref={doneRef} className="btn btn-primary" onClick={onClose}>
          {he.setup.categoriesDone}
        </button>
      </div>
    </div>
  );
}
