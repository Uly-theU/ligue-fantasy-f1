'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { DriverHistory, DriverReferenceLines, type DriverCardReference } from '@/components/f1/driver-reference';
import { formatCareer } from '@/lib/f1-reference';

type Driver = {
  id: string;
  name: string;
  short_name: string;
  base_price: number;
  metadata: { team?: string; car_number?: number; country?: string };
  f1_driver: DriverCardReference | null;
};

type Team = {
  current_budget: number | null;
  roster_assignments: Array<{ real_entity_id: string }>;
};

export default function MarketPage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [team, setTeam] = useState<Team | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      apiFetch<{ drivers: Driver[] }>('/api/f1/drivers'),
      apiFetch<{ team: Team }>(`/api/teams/${leagueId}`).catch(() => ({ team: null })),
    ]).then(([d, t]) => {
      setDrivers(d.drivers);
      setTeam(t.team);
      setLoading(false);
    });
  }, [leagueId]);

  const ownedIds = new Set(team?.roster_assignments.map((r) => r.real_entity_id) ?? []);

  async function handleBuy(driverId: string) {
    setBuying(driverId);
    try {
      await apiFetch(`/api/teams/${leagueId}/roster`, {
        method: 'POST',
        body: JSON.stringify({ real_entity_id: driverId, is_starter: false }),
      });
      // Refresh team
      const t = await apiFetch<{ team: Team }>(`/api/teams/${leagueId}`);
      setTeam(t.team);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erreur lors de l'achat", { variant: 'error' });
    } finally {
      setBuying(null);
    }
  }

  function formatPrice(price: number) {
    return `${(price / 1_000_000).toFixed(0)}M$`;
  }

  const filtered = drivers.filter(
    (d) =>
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.short_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.metadata.team ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  // Group by team
  const byTeam = filtered.reduce(
    (acc, d) => {
      const team = (d.metadata.team as string) ?? 'Autre';
      if (!acc[team]) acc[team] = [];
      acc[team].push(d);
      return acc;
    },
    {} as Record<string, Driver[]>,
  );

  if (loading) {
    return <div className="container py-10"><div className="h-64 bg-muted animate-pulse rounded-lg" /></div>;
  }

  return (
    <div className="container py-10 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/league/${leagueId}`} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Retour à la ligue">
            ←
          </Link>
          <div>
          <h1 className="text-3xl font-bold">💰 Marché des pilotes</h1>
          {team?.current_budget !== null && (
            <p className="text-muted-foreground">
              Budget restant : <span className="font-semibold text-foreground">{formatPrice(team?.current_budget ?? 0)}</span>
            </p>
          )}
          </div>
        </div>
      </div>

      <Input
        placeholder="Rechercher un pilote ou une écurie..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      {Object.entries(byTeam).map(([teamName, teamDrivers]) => {
        const constructor = teamDrivers.find((driver) => driver.f1_driver?.current_constructor)?.f1_driver?.current_constructor;
        return (
        <Card key={teamName}>
          <CardHeader>
            <CardTitle className="text-lg">{teamName}</CardTitle>
            {constructor && (
              <p className="text-xs font-normal text-muted-foreground">{formatCareer(constructor)}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {teamDrivers.map((d) => {
              const owned = ownedIds.has(d.id);
              const canAfford = team?.current_budget == null || team.current_budget >= d.base_price;

              return (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                    {d.short_name}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-medium text-sm">{d.name}</p>
                    <p className="text-xs text-muted-foreground">#{d.metadata.car_number} · {d.metadata.country}</p>
                    <DriverReferenceLines driver={d.f1_driver} />
                    {d.f1_driver && <DriverHistory entityId={d.id} />}
                  </div>
                  <span className="text-sm font-semibold">{formatPrice(d.base_price)}</span>
                  {owned ? (
                    <Badge variant="secondary">Dans ton roster</Badge>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!canAfford || buying === d.id}
                      onClick={() => handleBuy(d.id)}
                    >
                      {buying === d.id ? '...' : canAfford ? 'Acheter' : 'Trop cher'}
                    </Button>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
        );
      })}
    </div>
  );
}
