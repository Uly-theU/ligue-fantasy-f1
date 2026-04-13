'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiFetch, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';

type Feedback = {
  id: string;
  category: string;
  title: string;
  description: string;
  page_url: string | null;
  status: string;
  created_at: string;
};

const CATEGORIES = [
  { value: 'bug', label: 'Bug', emoji: '🐛', color: 'text-red-400' },
  { value: 'suggestion', label: 'Suggestion', emoji: '💡', color: 'text-yellow-400' },
  { value: 'ui', label: 'Interface', emoji: '🎨', color: 'text-blue-400' },
  { value: 'autre', label: 'Autre', emoji: '📝', color: 'text-muted-foreground' },
] as const;

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  new: { label: 'Nouveau', variant: 'outline' },
  read: { label: 'Lu', variant: 'secondary' },
  resolved: { label: 'Résolu', variant: 'default' },
};

export default function BetaPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [category, setCategory] = useState<string>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    fetchFeedbacks();
  }, [user, authLoading]);

  async function fetchFeedbacks() {
    try {
      const data = await apiFetch<{ feedbacks: Feedback[] }>('/api/beta');
      setFeedbacks(data.feedbacks);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Impossible de charger les feedbacks', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiFetch('/api/beta', {
        method: 'POST',
        body: JSON.stringify({
          category,
          title,
          description,
          page_url: pageUrl || undefined,
        }),
      });
      toast('Feedback envoyé, merci !', { variant: 'success' });
      setTitle('');
      setDescription('');
      setPageUrl('');
      await fetchFeedbacks();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : "Erreur lors de l'envoi", { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container py-10 max-w-3xl space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="container py-10 max-w-3xl space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold">Beta testeur</h1>
        <p className="text-muted-foreground">
          Merci de tester Fantasy F1 ! Signalez les bugs, proposez des améliorations ou donnez votre avis sur l&apos;interface.
        </p>
      </div>

      {/* Formulaire */}
      <Card>
        <CardHeader>
          <CardTitle>Nouveau feedback</CardTitle>
          <CardDescription>Décrivez ce que vous avez observé ou ce que vous aimeriez voir.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Catégorie */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Catégorie</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setCategory(c.value)}
                    className={cn(
                      'rounded-lg border-2 px-4 py-2 text-sm transition-colors',
                      category === c.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50',
                    )}
                  >
                    {c.emoji} {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Titre */}
            <div className="space-y-2">
              <label htmlFor="fb-title" className="text-sm font-medium">Titre</label>
              <Input
                id="fb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Résumé court du feedback"
                maxLength={200}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label htmlFor="fb-desc" className="text-sm font-medium">Description</label>
              <textarea
                id="fb-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={"Détaillez le problème ou la suggestion...\n\nPour un bug : étapes pour reproduire, comportement attendu vs observé."}
                rows={5}
                required
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
              />
            </div>

            {/* Page URL */}
            <div className="space-y-2">
              <label htmlFor="fb-url" className="text-sm font-medium">
                Page concernée <span className="text-muted-foreground font-normal">(optionnel)</span>
              </label>
              <Input
                id="fb-url"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder="Ex: /league/abc123/team"
                maxLength={500}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={submitting || !title.trim() || !description.trim()}>
              {submitting ? 'Envoi...' : 'Envoyer le feedback'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Historique */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Mes feedbacks ({feedbacks.length})</h2>
        {feedbacks.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Aucun feedback soumis pour le moment.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {feedbacks.map((fb) => {
              const cat = CATEGORIES.find((c) => c.value === fb.category);
              const status = STATUS_LABELS[fb.status] ?? STATUS_LABELS.new;
              return (
                <Card key={fb.id}>
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span>{cat?.emoji ?? '📝'}</span>
                        <h3 className="font-medium">{fb.title}</h3>
                      </div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-line">{fb.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{new Date(fb.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      {fb.page_url && <span>Page : {fb.page_url}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
