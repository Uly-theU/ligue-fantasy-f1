import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <div className="max-w-3xl text-center space-y-8">
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight">
          🏎️ Fantasy <span className="text-red-500">F1</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-xl mx-auto">
          Crée ton écurie virtuelle, drafté tes pilotes préférés et affronte tes amis
          tout au long de la saison 2026.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/login">Commencer</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/login">Se connecter</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 text-left">
          <div className="space-y-2">
            <div className="text-3xl">🏆</div>
            <h3 className="font-semibold">Ligues privées</h3>
            <p className="text-sm text-muted-foreground">
              Crée ta ligue, invite tes amis avec un code, et prouve que tu es le meilleur directeur d&apos;écurie.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">💰</div>
            <h3 className="font-semibold">Deux modes de jeu</h3>
            <p className="text-sm text-muted-foreground">
              Budget fixe ou draft exclusif — chaque ligue choisit son style.
            </p>
          </div>
          <div className="space-y-2">
            <div className="text-3xl">📊</div>
            <h3 className="font-semibold">Scoring en temps réel</h3>
            <p className="text-sm text-muted-foreground">
              Les points sont calculés automatiquement après chaque Grand Prix.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
