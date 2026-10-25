import { useMemo } from 'react';
import { encode } from 'uqr';

/**
 * קוד QR לקישור של החדר, כדי שאפשר יהיה להצטרף בסריקה מהטלפון של המארח.
 * תמיד שחור על לבן (גם במצב כהה), כי לא כל מצלמה סורקת קוד הפוך.
 */
export default function RoomQr({ url, label }: { url: string; label: string }) {
  const { path, size } = useMemo(() => {
    const qr = encode(url, { border: 2, ecc: 'M' });
    let d = '';
    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      }),
    );
    return { path: d, size: qr.size };
  }, [url]);

  return (
    <svg className="room-qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  );
}
