import { useEffect, useState } from 'react';

/** האם יש עוד תוכן מתחת לחלק הנראה של העמוד (כלומר אפשר לגלול עוד למטה) */
export function useContentBelow(): boolean {
  const [below, setBelow] = useState(false);

  useEffect(() => {
    const update = () => {
      const { scrollHeight } = document.documentElement;
      setBelow(scrollHeight - (window.scrollY + window.innerHeight) > 1);
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    // התוכן משתנה בלי גלילה, למשל כשמוסיפים שחקנים
    const observer = new ResizeObserver(update);
    observer.observe(document.body);

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);

  return below;
}
