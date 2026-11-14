# Bascule — Docker sur le VPS

L'app et Postgres tournent dans Docker Compose. Supabase reste l'auth (Google et lien magique). Les ligues, profils, scores et résultats sont dans le Postgres du Compose.

Preuve exigée avant cette checklist : `npm test` vert.

Le DNS est une action manuelle, hors boucle de test.

1. Sur le VPS, copier le dépôt et un `.env` calqué sur `.env.example` : URL et clé anon Supabase, `POSTGRES_PASSWORD`, `CRON_SECRET`.
2. `docker compose build` puis `docker compose up -d`. Le démarrage crée l'extension `uuid-ossp` et applique `schema.prisma` (`prisma db push`).
3. Ouvrir `http://<ip-du-vps>/login`. La connexion Supabase doit aboutir, et un profil doit apparaître dans la base `fantasy`.
4. Les crons partent à 19:00 UTC (ingestion) et 19:30 UTC (scores), dans le service `cron`.
5. Sauvegarde : `docker compose exec db pg_dump -U fantasy fantasy > fantasy.sql`.
6. Changer le DNS, puis poser `SITE_ADDRESS=le-domaine` et redémarrer Caddy, seulement après une demande explicite.
7. Retour arrière : garder l'image précédente (`docker compose images`) et le volume `pgdata`. Ne pas supprimer le volume pour annuler un déploiement.

Postgres n'écoute que sur `127.0.0.1:5432` de la machine. Le port 80 du VPS ne doit pas déjà être pris.
