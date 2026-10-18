import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion, vibrate } from '../ui/vibrate';

/**
 * אנימציית "רולטה" שמסתובבת על כל המושבים עם כיוון השעון, מאטה ונוחתת על מי שמתחיל.
 * עוברת על כל השחקנים, כולל המתחזה, כדי שהאנימציה עצמה לא תסגיר כלום.
 */
export function useStarterDraw(count: number, target: number, enabled: boolean, onDone: () => void) {
  const animate = enabled && !prefersReducedMotion();
  const [index, setIndex] = useState(animate ? 0 : target);
  const [done, setDone] = useState(!animate);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  });

  useEffect(() => {
    if (!enabled) return;
    if (!animate) {
      onDoneRef.current();
      return;
    }

    const laps = Math.max(1, Math.ceil(16 / count));
    const totalSteps = laps * count + target;
    let step = 0;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      step++;
      setIndex(step % count);
      if (step >= totalSteps) {
        setDone(true);
        vibrate(60);
        onDoneRef.current();
        return;
      }
      const progress = step / totalSteps;
      timer = setTimeout(tick, 50 + 320 * progress ** 3);
    };

    timer = setTimeout(tick, 250);
    return () => clearTimeout(timer);
  }, [enabled, animate, count, target]);

  return { highlightIndex: index, done };
}
