import { useMemo } from 'react';

export default function Bubbles({ count = 22 }) {
  const bubbles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const size = 4 + Math.random() * 14;
      const dur = 10 + Math.random() * 14;
      return {
        id: i,
        size,
        left: Math.random() * 100,
        drift: Math.random() * 60 - 30,
        duration: dur,
        delay: -Math.random() * dur,
      };
    });
  }, [count]);

  return (
    <div id="bubbles">
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="bubble"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            '--drift': `${b.drift}px`,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
