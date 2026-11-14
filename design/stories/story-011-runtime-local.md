# Story 011: Runtime Next prêt à quitter Vercel

> **Phase** : Ship — gate D
> **Type** : Integration
> **Statut** : Done

## Contexte

**Exigence** : quitter Vercel pour un VPS Hostinger, plus tard.
**Code** : `next.config.mjs`, `package.json`.

La vérification de cette story est locale. Le VPS n'est pas le banc de test.

## Critères d'acceptation

- [x] `next build` produit un serveur `standalone`.
- [x] `next start` sert la page de login sur localhost.
- [x] Les unités systemd et la config de reverse proxy sont dans le dépôt, prêtes à copier, et ne sont pas installées sur le VPS pour fermer la story.
- [x] Supabase reste l'auth et la base. Aucun secret n'est commité.

## Notes d'implémentation

`output: 'standalone'` dans la config Next. Documenter la commande de démarrage locale dans un commentaire du fichier d'unité, pas dans un nouveau guide.

Les secrets restent dans `.env`, déjà ignoré. `.env.example` liste les clés sans valeurs réelles.

## Hors périmètre

- Story 012 : appel des crons.
- Story 014 : DNS et retrait de `vercel.json`.
- Déménagement de Postgres hors Supabase.

## Tests

**Banc** : local uniquement.

- **AC-1** : build
  - Given: les dépendances installées en local
  - When: `npm run build` puis `npm start`
  - Then: `http://localhost:3000/login` répond

## Dépendances

- Dépend de : Story 002
- Débloque : Stories 012, 013
