# Story 014: Checklist de bascule, preuve en local

> **Phase** : Ship — gate D
> **Type** : Config
> **Statut** : Ready

## Contexte

**Exigence** : à terme, le domaine quitte Vercel pour le VPS Hostinger.
**Décision du 6 octobre 2026** : le changement DNS est une action manuelle, hors boucle de test. La story est fermée quand les routes cron sont vertes en local et que la checklist est dans le dépôt.

## Critères d'acceptation

- [ ] Une checklist courte décrit l'ordre : arrêt des crons Vercel, déploiement du build standalone, timers, puis DNS.
- [ ] `vercel.json` est retiré seulement quand les stories 002 et 012 sont vertes en local.
- [ ] Aucun test ne vise `ligue-fantasy-f1.vercel.app` ni le domaine public.
- [ ] La checklist rappelle que Supabase ne bouge pas.

## Notes d'implémentation

La checklist tient dans `production/ligue-fantasy-f1/` ou à côté des unités systemd. Pas de nouveau guide utilisateur.

Le DNS lui-même attend une demande explicite. Le faire pendant cette story contredirait le banc local.

## Hors périmètre

- Achat, DNS Hostinger, certificat sur le VPS : action manuelle ultérieure.
- Stories 001 à 010 : règles de jeu.

## Tests

**Banc** : local uniquement.

- **AC-1** : fixture de course
  - Given: l'app locale, le secret, une fixture de résultats
  - When: le script de la story 012 tourne
  - Then: l'ingestion et le score se font sur localhost

## Dépendances

- Dépend de : Stories 012, 013
- Débloque : Aucune
