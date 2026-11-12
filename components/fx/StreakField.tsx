const streaks = [
  { top: '32%', width: '28%', duration: '2.4s', delay: '-0.4s' },
  { top: '52%', width: '18%', duration: '1.5s', delay: '-0.8s', red: true },
  { top: '70%', width: '40%', duration: '3s', delay: '-1.3s', dim: true },
];

export function StreakField() {
  return (
    <div className="streak-field" aria-hidden>
      {streaks.map((streak) => (
        <span
          key={`${streak.top}-${streak.delay}`}
          className={streak.red ? 'streak streak-red' : 'streak'}
          style={{
            top: streak.top,
            width: streak.width,
            animationDuration: streak.duration,
            animationDelay: streak.delay,
            opacity: streak.dim ? 0.4 : 0.85,
          }}
        />
      ))}
    </div>
  );
}
