# WarLike Control Center

Console centralisée pour **ChatGPT / OpenAI**, **Claude / Anthropic**, **Cloudflare**, **Meshy** et **GitHub**, destinée à l'écosystème WarLike.

## Ce qui est livré

- Interface initiale accessible, responsive, thèmes sombre/clair, navigation et filtrage de services dans `index.html`.
- Pages Connecteurs, Automatisations, Projets, Sécurité.
- Architecture cible et deux workflows documentés.
- Tous les connecteurs affichent explicitement **Non vérifié**. **Aucun des cinq fournisseurs n'est encore connecté depuis cette application.**

## Architecture cible

```
WarLike Control Center (front-end)
          |
WarLike Server + Keys (sessions, permissions, API)
          |
Orchestrateur (tâches, quotas, audit, approbations)
          +-- OpenAI API (ChatGPT)
          +-- Anthropic API (Claude)
          +-- Cloudflare API
          +-- Meshy API
          +-- GitHub API
          |
WarLike MCP : outils Engine autorisés, sans exécution arbitraire
```

WarLike Server est la **source de vérité**. Ses bindings D1/R2 et l'authentification WarLike Keys doivent être réutilisés. WarLike MCP conserve son rôle de proxy MCP pour l'Engine ; il ne faut pas lui donner un accès générique à la machine ou au navigateur.

## Étapes suivantes (non réalisées)

1. Intégrer les comptes WarLike Keys et les permissions rôle/projet/action via Server.
2. Implémenter `GET /api/control/connectors`, `GET /api/control/projects`, `POST /api/control/tasks` avec validation de session et contrôles d'accès.
3. Créer cinq adaptateurs backend distincts, avec authentification et secret serveur seulement.
4. Stocker en D1 les tâches, étapes, approbations et événements d'audit ; conserver les assets en R2.
5. Utiliser Queues/Workflows pour les opérations longues, les retries, l'idempotence et les limitations de coûts.
6. Ajouter webhooks signés, garde-fous sur les actions destructrices, budgets et approbation avant merge/déploiement.
7. Ajouter les tests automatiques d'intégration et une vérification de connexion réelle, puis déployer.

## Workflows visés

**Développement :** ticket → ChatGPT → branche/PR GitHub → revue Claude → CI → approbation humaine → déploiement Cloudflare.

**3D :** brief → Meshy → contrôle des modèles → Cloudflare R2 → WarLike Library → Engine.

Ces flux sont **des spécifications**, pas des automatisations déjà opérationnelles.

## Démarrage et déploiement

Ouvrir `index.html` dans un navigateur pour la démonstration locale, ou déployer les fichiers statiques vers Cloudflare Pages / Workers Static Assets. Ne pas placer de jetons dans le front-end, les fichiers Git ou le stockage du navigateur.

Projet lié : [WarLike Server](https://github.com/Motherlode94/WarLike-Server) et [WarLike MCP](https://github.com/Motherlode94/WarLike-MCP).
