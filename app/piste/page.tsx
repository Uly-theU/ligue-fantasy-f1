const motions = [
  {
    id: 'feux',
    name: 'Feux de départ',
    text: 'Cinq feux s’allument un par un, restent rouges, puis s’éteignent. Le geste de la grille, une fois toutes les quelques secondes.',
  },
  {
    id: 'ligne',
    name: 'Ligne blanche',
    text: 'Le bitume défile. Une ligne discontinue file vers l’avant, comme la vue depuis le cockpit.',
  },
  {
    id: 'vibreur',
    name: 'Vibreur',
    text: 'Une bande rouge et blanche glisse sur le bord, le rythme du vibreur quand la monoplace mord la piste.',
  },
  {
    id: 'trainee',
    name: 'Traînée',
    text: 'Des filets de lumière passent à des vitesses différentes. On les voit du coin de l’œil, le reste de l’écran reste noir.',
  },
] as const;

const swatches = [
  { name: 'Carbone', hex: '#09090B', ink: '#F4F4F5' },
  { name: 'Aluminium', hex: '#A1A1AA', ink: '#09090B' },
  { name: 'Craie', hex: '#F4F4F5', ink: '#09090B' },
  { name: 'Rouge course', hex: '#E10600', ink: '#F4F4F5' },
] as const;

export default function PistePage() {
  return (
    <div className="piste-page px-4 py-10">
      <style>{css}</style>
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="max-w-2xl space-y-2">
          <p className="piste-kicker">Palette</p>
          <h1 className="text-3xl font-semibold tracking-tight">Asphalte</h1>
          <p className="text-sm piste-muted">
            Carbone, craie, aluminium, et un seul rouge pour agir. Le turquoise et l’orange de la nuit Métis disparaissent. Les animations viennent de la piste, pas d’un fluide.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {swatches.map((swatch) => (
            <div key={swatch.name} className="piste-swatch" style={{ background: swatch.hex, color: swatch.ink }}>
              <span className="text-sm font-medium">{swatch.name}</span>
              <span className="font-mono text-[11px] opacity-80">{swatch.hex}</span>
            </div>
          ))}
        </div>

        <section className="piste-hero">
          <div className="space-y-4">
            <p className="piste-kicker">Saison 2026</p>
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Fantasy <span className="piste-red">F1</span>
            </h2>
            <p className="max-w-md text-sm piste-muted">
              Le bouton rouge est la seule action. Le reste reste en craie sur le carbone.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="piste-btn">Commencer</span>
              <span className="piste-btn piste-btn-ghost">Se connecter</span>
            </div>
          </div>
          <div className="piste-sample">
            <p className="text-sm font-medium">Paddock test</p>
            <p className="text-xs piste-muted">Verrou dans 94 h · Mexico</p>
            <p className="piste-red mt-3 font-mono text-xs">En cours</p>
          </div>
        </section>

        <div>
          <h2 className="text-lg font-semibold">Animations de piste</h2>
          <p className="mt-1 max-w-2xl text-sm piste-muted">
            Chacune peut vivre dans le fond, discrète, sans remplacer les photos.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {motions.map((motion) => (
            <section key={motion.id} className="space-y-3">
              <div className={`piste-stage piste-${motion.id}`} aria-hidden>
                {motion.id === 'feux' && (
                  <div className="piste-lights">
                    <span /><span /><span /><span /><span />
                  </div>
                )}
                {motion.id === 'trainee' && (
                  <>
                    <i className="piste-streak s1" />
                    <i className="piste-streak s2" />
                    <i className="piste-streak s3" />
                  </>
                )}
                <div className="piste-card">
                  <p className="text-sm font-medium">Paddock test</p>
                  <p className="text-xs piste-muted">Verrou dans 94 h · Mexico</p>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{motion.name}</h3>
                <p className="text-sm piste-muted">{motion.text}</p>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

const css = `
.piste-page {
  background: #09090b;
  color: #f4f4f5;
  min-height: calc(100vh - 3.5rem);
}
.piste-kicker {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #e10600;
}
.piste-muted { color: #a1a1aa; }
.piste-red { color: #e10600; }
.piste-swatch {
  display: flex;
  min-height: 5.5rem;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 1rem;
  border: 1px solid rgb(255 255 255 / 0.08);
  padding: 0.9rem 1rem;
}
.piste-hero {
  display: grid;
  gap: 1.5rem;
  border-radius: 1.5rem;
  border: 1px solid rgb(255 255 255 / 0.1);
  background:
    linear-gradient(180deg, rgb(9 9 11 / 0.55), rgb(9 9 11 / 0.78)),
    url('/photos/circuits/silverstone.jpg') center 62% / cover;
  padding: 1.75rem;
}
@media (min-width: 768px) {
  .piste-hero { grid-template-columns: 1.4fr 0.8fr; align-items: end; padding: 2.25rem; }
}
.piste-btn {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: #e10600;
  color: #f4f4f5;
  padding: 0.7rem 1.15rem;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 10px 28px -12px rgb(225 6 0 / 0.9);
}
.piste-btn-ghost {
  background: rgb(255 255 255 / 0.06);
  color: #f4f4f5;
  border: 1px solid rgb(255 255 255 / 0.16);
  box-shadow: none;
}
.piste-sample, .piste-card {
  border-radius: 1rem;
  border: 1px solid rgb(255 255 255 / 0.12);
  background: rgb(9 9 11 / 0.55);
  backdrop-filter: blur(16px);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.1);
  padding: 1rem 1.1rem;
}
.piste-stage {
  position: relative;
  overflow: hidden;
  height: 16rem;
  border-radius: 1.5rem;
  border: 1px solid rgb(255 255 255 / 0.1);
  background: #09090b;
}
.piste-card {
  position: absolute;
  left: 1.25rem;
  bottom: 1.25rem;
  max-width: 16rem;
}
.piste-lights {
  position: absolute;
  top: 1.5rem;
  left: 50%;
  display: flex;
  gap: 0.7rem;
  transform: translateX(-50%);
  padding: 0.7rem 0.9rem;
  border-radius: 999px;
  background: #141416;
  border: 1px solid rgb(255 255 255 / 0.08);
}
.piste-lights span {
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 999px;
  background: #3a1212;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.4);
  animation: piste-light 6.4s linear infinite;
}
.piste-lights span:nth-child(2) { animation-delay: 0.35s; }
.piste-lights span:nth-child(3) { animation-delay: 0.7s; }
.piste-lights span:nth-child(4) { animation-delay: 1.05s; }
.piste-lights span:nth-child(5) { animation-delay: 1.4s; }
@keyframes piste-light {
  0%, 18% { background: #3a1212; box-shadow: none; }
  28%, 62% { background: #e10600; box-shadow: 0 0 12px rgb(225 6 0 / 0.85); }
  72%, 100% { background: #3a1212; box-shadow: none; }
}
.piste-ligne {
  background-color: #121214;
  background-image: repeating-linear-gradient(180deg, #f4f4f5 0 22px, transparent 22px 44px);
  background-size: 10px 88px;
  background-repeat: repeat-y;
  background-position: center 0;
  animation: piste-road 0.55s linear infinite;
}
@keyframes piste-road {
  to { background-position: center 88px; }
}
.piste-vibreur::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2.4rem;
  background: repeating-linear-gradient(-58deg, #e10600 0 14px, #f4f4f5 14px 28px);
  background-size: 48px 100%;
  animation: piste-kerb 0.8s linear infinite;
}
@keyframes piste-kerb {
  to { background-position: 48px 0; }
}
.piste-streak {
  position: absolute;
  height: 2px;
  border-radius: 999px;
  background: linear-gradient(90deg, transparent, #f4f4f5, transparent);
  opacity: 0.85;
  animation: piste-pass 2.8s linear infinite;
}
.piste-streak.s1 { top: 28%; width: 38%; animation-duration: 2.2s; }
.piste-streak.s2 { top: 46%; width: 22%; animation-duration: 1.35s; animation-delay: -0.6s; background: linear-gradient(90deg, transparent, #e10600, transparent); }
.piste-streak.s3 { top: 63%; width: 52%; animation-duration: 3.1s; animation-delay: -1.2s; opacity: 0.45; }
@keyframes piste-pass {
  from { left: -55%; }
  to { left: 120%; }
}
@media (prefers-reduced-motion: reduce) {
  .piste-lights span,
  .piste-ligne,
  .piste-vibreur::before,
  .piste-streak { animation: none; }
}
`;
