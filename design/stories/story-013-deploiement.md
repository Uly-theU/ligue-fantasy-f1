# Story 013: Livraison testée en local

> **Phase** : Ship — gate D
> **Type** : Integration
> **Statut** : Ready

## Contexte

**Exigence** : un déploiement reproductible vers le VPS, plus tard, avec retour arrière.
**Décision** : la porte de livraison se ferme en local. Une exécution GitHub Actions n'est pas exigée pour terminer la story.

## Critères d'acceptation

- [ ] `npm test` est la commande de porte, et elle passe en local.
- [ ] Un workflow est dans le dépôt : tests, puis build. Il ne contient pas de secret.
- [ ] Le build précédent peut être relancé en local (artefact ou commit identifié). Le retour arrière visé reste sous 5 minutes une fois le VPS en service.
- [ ] Fermer la story ne demande pas un push ni une visite de Vercel.

## Notes d'implémentation

Le workflow décrit les étapes. Le jour du VPS, il pourra ajouter un transfert SSH. Cet ajout n'est pas un critère maintenant.

## Hors périmètre

- Story 014 : le DNS.
- Surveillance de production.

## Tests

**Banc** : local uniquement.

- **AC-1** : porte
  - Given: le checkout courant
  - When: `npm test`
  - Then: succès, sans réseau vers Vercel ni Hostinger

## Dépendances

- Dépend de : Story 011
- Débloque : Story 014
