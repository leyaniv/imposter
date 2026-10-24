import type { ReactNode } from 'react';

/** מסך פשוט עם הודעה וכפתורים: מתחברים, החדר נסגר, יש גרסה חדשה וכו' */
export default function MessageScreen({ title, text, children }: { title?: string; text: string; children: ReactNode }) {
  return (
    <main className="screen">
      <div className="screen-body center">
        {title && <h1 className="heading">{title}</h1>}
        <p className={title ? 'muted' : 'label'}>{text}</p>
      </div>
      <div className="screen-actions">{children}</div>
    </main>
  );
}
