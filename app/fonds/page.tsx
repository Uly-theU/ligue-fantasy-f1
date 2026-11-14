const proposals = [
  {
    id: 'calme',
    name: 'Calme',
    text: 'Deux lueurs fixes, turquoise en haut à gauche, orange en bas à droite. Rien ne bouge. Le regard reste sur les photos et les chiffres.',
  },
  {
    id: 'soie',
    name: 'Soie',
    text: 'Une seule bande large traverse l’écran très lentement, du turquoise vers l’orange. Pas de suivi de souris.',
  },
  {
    id: 'phare',
    name: 'Phare',
    text: 'La nuit reste plate. Un trait de lumière passe de temps en temps, comme des phares sur une ligne droite, puis le fond se tait.',
  },
  {
    id: 'verre',
    name: 'Verre',
    text: 'De petites taches de lumière, comme des reflets sous une vitre. Le liquide est dans les reflets, pas dans de gros nuages colorés.',
  },
] as const;

export default function FondsPage() {
  return (
    <div className="bg-night px-4 py-10">
      <style>{css}</style>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="max-w-2xl space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">Fond</p>
          <h1 className="text-3xl font-semibold tracking-tight">Quatre autres nuits</h1>
          <p className="text-sm text-muted-foreground">
            Le grain reste. Chaque cadre montre le même bloc de texte que sur une carte, pour juger si le fond aide ou distrait.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {proposals.map((proposal) => (
            <section key={proposal.id} className="space-y-3">
              <div className={`fond-stage fond-${proposal.id}`} aria-hidden>
                <div className="fond-card">
                  <p className="text-sm font-medium">Paddock test</p>
                  <p className="text-xs text-white/70">Verrou dans 94 h · Mexico</p>
                </div>
              </div>
              <div>
                <h2 className="text-lg font-semibold">{proposal.name}</h2>
                <p className="text-sm text-muted-foreground">{proposal.text}</p>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

const css = `
.fond-stage {
  position: relative;
  overflow: hidden;
  height: 16rem;
  border-radius: 1.5rem;
  border: 1px solid rgb(255 255 255 / 0.1);
  background: #0b1322;
}
.fond-card {
  position: absolute;
  left: 1.25rem;
  bottom: 1.25rem;
  max-width: 16rem;
  padding: 0.85rem 1rem;
  border-radius: 1rem;
  border: 1px solid rgb(255 255 255 / 0.12);
  background: rgb(11 19 34 / 0.45);
  backdrop-filter: blur(16px);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.12);
}
.fond-calme {
  background:
    radial-gradient(28rem 18rem at 0% 0%, rgb(13 179 187 / 0.38), transparent 62%),
    radial-gradient(24rem 16rem at 100% 100%, rgb(247 138 53 / 0.22), transparent 60%),
    #0b1322;
}
.fond-soie::before,
.fond-phare::before,
.fond-verre::before,
.fond-verre::after {
  content: '';
  position: absolute;
  pointer-events: none;
}
.fond-soie::before {
  width: 160%;
  height: 46%;
  left: -30%;
  top: 27%;
  background: linear-gradient(100deg, transparent, rgb(13 179 187 / 0.45), rgb(231 237 243 / 0.16), rgb(247 138 53 / 0.4), transparent);
  filter: blur(26px);
  animation: fond-soie 14s ease-in-out infinite;
}
.fond-phare {
  background:
    linear-gradient(180deg, transparent 47%, rgb(231 237 243 / 0.06) 50%, transparent 53%),
    #0b1322;
}
.fond-phare::before {
  top: 18%;
  width: 28%;
  height: 64%;
  left: -32%;
  background: linear-gradient(90deg, transparent, rgb(231 237 243 / 0.75), rgb(13 179 187 / 0.5), transparent);
  filter: blur(10px);
  animation: fond-phare 6.5s ease-in-out infinite;
}
.fond-verre::before {
  inset: -10%;
  background:
    radial-gradient(circle at 18% 30%, rgb(255 255 255 / 0.16), transparent 12%),
    radial-gradient(circle at 72% 42%, rgb(13 179 187 / 0.28), transparent 14%),
    radial-gradient(circle at 48% 78%, rgb(247 138 53 / 0.18), transparent 12%),
    radial-gradient(circle at 84% 80%, rgb(255 255 255 / 0.1), transparent 10%);
  filter: blur(8px);
  animation: fond-verre 18s ease-in-out infinite;
}
.fond-verre::after {
  width: 70%;
  height: 30%;
  left: 10%;
  top: 20%;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.08), transparent);
  filter: blur(18px);
  transform: rotate(-8deg);
}
@keyframes fond-soie {
  0%, 100% { transform: translateX(-6%) rotate(-7deg); }
  50% { transform: translateX(10%) rotate(5deg); }
}
@keyframes fond-phare {
  0%, 18% { transform: translateX(0); opacity: 0; }
  32% { opacity: 1; }
  58%, 100% { transform: translateX(520%); opacity: 0; }
}
@keyframes fond-verre {
  0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(2%, -3%, 0) scale(1.05); }
}
@media (prefers-reduced-motion: reduce) {
  .fond-soie::before,
  .fond-phare::before,
  .fond-verre::before { animation: none; }
}
`;
