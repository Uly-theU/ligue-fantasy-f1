import Link from 'next/link';
import { ReplayStartLights } from '@/components/fx/StartLights';
import { Button } from '@/components/ui/button';
import { PhotoPlate } from '@/components/ui/photo-plate';

const features = [
  {
    title: 'Ligues privées',
    text: 'Crée ta ligue, invite tes amis avec un code, et prouve que tu es le meilleur directeur d’écurie.',
    photo: '/photos/circuits/monaco.jpg',
  },
  {
    title: 'Deux modes de jeu',
    text: 'Budget fixe ou draft exclusif — chaque ligue choisit son style.',
    photo: '/photos/circuits/mclaren.jpg',
  },
  {
    title: 'Scoring après chaque GP',
    text: 'Les points sont calculés automatiquement à partir de l’alignement figé.',
    photo: '/photos/circuits/silverstone.jpg',
  },
];

export default function Home() {
  return (
    <div className="px-4 pb-16 pt-8">
      <PhotoPlate src="/intro/grid-v4.webp" alt="Une monoplace sur la grille de départ, de nuit" className="home-hero mx-auto max-w-6xl min-h-[28rem]">
        <div className="flex min-h-[28rem] flex-col items-start justify-end gap-6 p-8 sm:p-14">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">Saison 2026</p>
          <h1 className="max-w-xl text-5xl font-semibold tracking-tight sm:text-7xl">
            Fantasy <span className="text-ember">F1</span>
          </h1>
          <p className="max-w-lg text-lg text-white/80">
            La prochaine décision est la tienne. Crée ton écurie et entre dans la saison 2026.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login">Commencer</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Se connecter</Link>
            </Button>
          </div>
        </div>
      </PhotoPlate>

      <div className="mx-auto mt-4 flex max-w-6xl justify-end"><ReplayStartLights /></div>

      <div className="mx-auto mt-8 grid max-w-6xl gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <PhotoPlate key={feature.title} src={feature.photo} className="min-h-52">
            <div className="flex min-h-52 flex-col justify-end p-6">
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm text-white/75">{feature.text}</p>
            </div>
          </PhotoPlate>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-6xl text-xs text-muted-foreground">
        Visuel d’accueil : création IA. Photos des circuits : Wikimedia Commons (CC BY / CC BY-SA) — Monaco, Silverstone, Spa, Monza, Suzuka, Mexico, McLaren, portraits Stepro.
      </p>
    </div>
  );
}
