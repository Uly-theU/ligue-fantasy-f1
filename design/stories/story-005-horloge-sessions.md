# Story 005: Horloge réelle des sessions

> **Phase** : Alpha — gate A
> **Type** : Logic
> **Statut** : Ready

## Contexte

**Exigence** : diagnostic qualité, zone « Statuts GP ».
**Code** : `app/api/f1/calendar/route.ts`, `prisma/schema.prisma` (`Gameweek`), `prisma/seed.ts`.

`qualifying_date` et `race_date` sont des `@db.Date`. Stockées à minuit UTC, elles font passer le GP `live` dès le début du jour de qualifications, puis `completed` vers 03:00 UTC le dimanche, avant le départ. Dans le même `GET /api/f1/calendar`, le passage `upcoming → locked` est aussitôt écrasé par `locked → live`, parce que minuit est déjà dépassé quand `lock_time` (14:00 UTC dans le seed) tombe.

## Critères d'acceptation

- [ ] Les instants de lock, de début de qualifications et de fin de course sont des horodatages, pas des dates à minuit.
- [ ] `upcoming → locked` quand `lock_time` est atteint, et cet état reste `locked` jusqu'au début réel des qualifications.
- [ ] `locked → live` utilise cet instant de qualifications, pas le minuit du jour.
- [ ] `live → completed` utilise la fin de course (départ + délai), pas le minuit du dimanche moins 3 h.
- [ ] Une fonction pure décide la transition. La route ne fait qu'appliquer son résultat.

## Notes d'implémentation

Extraire la décision de statut dans un module testable, par exemple `lib/gameweek-status.ts`. Le seed peut garder des horaires de référence en UTC tant que les colonnes ne tronquent plus l'heure.

`lock_time` existe déjà en `Timestamptz`. Le trou est `qualifying_date` / `race_date` en `Date`, et les `updateMany` enchaînés dans `app/api/f1/calendar/route.ts`.

## Hors périmètre

- Story 001 : copier l'alignement au moment du lock.
- Story 004 : contenu OpenF1 des performances.
- Story 012 : timers du VPS.

## Tests

**Banc** : local uniquement. Vitest. Pas de Vercel, pas de VPS, pas de Supabase distant.

- **AC-1** : samedi 13:00 UTC, lock 14:00, qualifications 15:00
  - Given: statut `upcoming`
  - When: l'horloge vaut 13:00
  - Then: le statut reste `upcoming`
- **AC-2** : samedi 14:30 UTC
  - Given: lock 14:00, qualifications 15:00
  - When: la transition est calculée
  - Then: le statut est `locked`, pas `live`
- **AC-3** : dimanche 02:00 UTC, course à 15:00
  - Given: statut `live`
  - When: la transition est calculée
  - Then: le statut n'est pas `completed`

## Dépendances

- Dépend de : Aucune
- Débloque : Story 001
