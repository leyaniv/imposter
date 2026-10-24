import type { HTMLAttributes } from 'react';

/** ידית גרירה לשינוי סדר בשורה (שש נקודות). את האירועים מעבירים מ-useDragReorder */
export default function DragHandle({ label, ...events }: { label: string } & HTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="drag-handle" aria-label={label} {...events}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {[6, 12, 18].map((y) => (
          <g key={y}>
            <circle cx="9" cy={y} r="1.6" />
            <circle cx="15" cy={y} r="1.6" />
          </g>
        ))}
      </svg>
    </button>
  );
}
