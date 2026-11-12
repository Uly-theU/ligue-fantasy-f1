const tones = [
  {
    id: 'paddock',
    name: 'Paddock',
    text: 'Vert course sur Silverstone. Le voile laisse passer la pelouse et la monoplace.',
    photo: '/photos/circuits/silverstone.jpg',
    focus: 'center 68%',
    veil: 'rgb(16 48 36 / 0.55)',
    header: 'rgb(8 28 22 / 0.55)',
    card: 'rgb(243 246 241 / 0.08)',
    ink: '#f3f6f1',
    muted: '#b7c9bc',
  },
  {
    id: 'nuit',
    name: 'Nuit de GP',
    text: 'Indigo sur le port de Monaco. La ville reste lisible sous le voile.',
    photo: '/photos/circuits/monaco.jpg',
    focus: 'center 58%',
    veil: 'rgb(22 16 64 / 0.52)',
    header: 'rgb(12 8 40 / 0.5)',
    card: 'rgb(244 241 251 / 0.08)',
    ink: '#f4f1fb',
    muted: '#c4bddf',
  },
  {
    id: 'sable',
    name: 'Sable',
    text: 'Ambre sur la monoplace papaye. Le brun réchauffe l’orange au lieu de l’aplatir.',
    photo: '/photos/circuits/mclaren.jpg',
    focus: 'center 45%',
    veil: 'rgb(58 32 18 / 0.5)',
    header: 'rgb(36 20 12 / 0.5)',
    card: 'rgb(248 241 230 / 0.1)',
    ink: '#f8f1e6',
    muted: '#d9c4ae',
  },
] as const;

export default function TeintesPage() {
  return (
    <div className="bg-background px-4 py-10">
      <style>{css}</style>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="max-w-xl space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ember">Teintes</p>
          <h1 className="text-3xl font-semibold tracking-tight">Autre chose que le gris</h1>
          <p className="text-sm text-muted-foreground">
            La même teinte, posée en voile sur une photo de circuit. Le rouge d’action reste.
          </p>
        </div>
        {tones.map((tone) => (
          <section key={tone.id} className="space-y-3">
            <div
              className="teinte"
              style={{
                backgroundImage: `linear-gradient(${tone.veil}, ${tone.veil}), url(${tone.photo})`,
                backgroundPosition: tone.focus,
                color: tone.ink,
              }}
            >
              <div className="teinte-header" style={{ background: tone.header }}>
                <span className="teinte-streak" />
                <span className="teinte-streak teinte-streak-red" />
                <span className="relative font-semibold">Fantasy <span className="text-ember">F1</span></span>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-2xl font-semibold">Mes Ligues</h2>
                  <span className="teinte-btn">Créer une ligue</span>
                </div>
                <div className="teinte-card" style={{ background: tone.card, borderColor: 'rgb(255 255 255 / 0.16)' }}>
                  <p className="font-medium">Paddock test</p>
                  <p className="text-sm" style={{ color: tone.muted }}>Verrou dans 94 h · Mexico</p>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold">{tone.name}</h3>
              <p className="text-sm text-muted-foreground">{tone.text}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const css = `
.teinte { overflow: hidden; border-radius: 1.5rem; border: 1px solid rgb(255 255 255 / 0.12); background-size: cover; background-position: center; }
.teinte-header { position: relative; display: flex; align-items: center; height: 3.5rem; padding: 0 1.25rem; overflow: hidden; }
.teinte-streak, .teinte-streak-red {
  position: absolute; height: 3px; border-radius: 999px; animation: teinte-pass linear infinite;
}
.teinte-streak { top: 38%; width: 34%; background: linear-gradient(90deg, transparent, #f4f4f5, transparent); animation-duration: 2.2s; }
.teinte-streak-red { top: 62%; width: 22%; background: linear-gradient(90deg, transparent, #e10600, transparent); animation-duration: 1.5s; animation-delay: -.6s; }
.teinte-btn { border-radius: 999px; background: #e10600; color: white; font-size: 0.8rem; font-weight: 600; padding: 0.45rem 0.8rem; }
.teinte-card { border-radius: 1rem; border: 1px solid; padding: 1rem 1.1rem; }
@keyframes teinte-pass { from { left: -40%; } to { left: 110%; } }
@media (prefers-reduced-motion: reduce) {
  .teinte-streak, .teinte-streak-red { animation: none; left: 20%; }
}
`;
