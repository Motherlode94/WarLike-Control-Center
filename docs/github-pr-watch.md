# Module GitHub PR Watch

Audit centralisé des Pull Requests de tous les dépôts appartenant à `Motherlode94` auxquels le jeton de lecture a accès.

## Fonctionnement
- Exécution quotidienne à 07:15 UTC et exécution manuelle par GitHub Actions.
- Recensement des PR ouvertes, y compris Draft, CI rouge, conflits, et PR sans activité depuis 7 jours.
- Rapport Markdown + JSON dans les artifacts du workflow, et résumé de chaque exécution.
- Un seul ticket GitHub « WarLike PR Watch — suivi des Pull Requests » est créé ou mis à jour dans **Control Center** quand les permissions le permettent.
- Les anciens correctifs remplacés sont à examiner manuellement : la détection ne présume pas qu'une PR est abandonnée ni qu'elle peut être fermée.
- **Aucune fusion, fermeture, suppression ou modification des autres dépôts.**

## Mise en service
1. Sur `Motherlode94/WarLike-Control-Center`, ajouter le secret Actions `WARLIKE_GITHUB_READ_TOKEN` : fine-grained GitHub PAT avec accès aux dépôts à surveiller, permission **Metadata: Read** et **Pull requests: Read**. La permission Checks: Read peut être nécessaire pour récupérer les checks selon les dépôts; les résultats non accessibles sont explicitement signalés.
2. Dans **Settings → Actions → General**, autoriser `GITHUB_TOKEN` avec les permissions nécessaires à la création d'issues pour ce dépôt. Si la politique de l'organisation interdit cette permission, les rapports restent dans les artifacts et le job summary.
3. Activer les workflows et lancer **Actions → WarLike PR Watch → Run workflow** sur `main` après fusion de la PR du module.
4. Ouvrir le rapport `warlike-pr-watch` dans les artifacts du workflow ou le ticket de suivi.

Sans le secret multi-dépôts, le `GITHUB_TOKEN` standard du workflow ne permet généralement pas d'auditer les dépôts privés autres que Control Center. **Ne jamais inclure le jeton dans le JS du navigateur, un commit ou Cloudflare Pages.**

## Priorités
- P0 : conflit Git ou échec CI.
- P1 : PR inactive depuis 7 jours.
- P2 : Draft actif.
- P3 : PR ouverte ordinaire.

Dans le cas de plusieurs motifs, la priorité la plus élevée s'applique. Un statut de fusion indéterminé n'est pas interprété comme conflit; des checks non accessibles ne sont pas interprétés comme réussis.

## Tests
`node --test tests/github-pr-watch.test.mjs`

## Évolutions envisagées
- Branches automatiquement marquées « probablement remplacée » après comparaison explicite des commits et du périmètre.
- Page « GitHub / Pull Requests » dans Control Center, servie par une API authentifiée de WarLike Server.
- Historique en D1, alertes facultatives Web Push, et revue par ChatGPT / Claude sur demande et avec droits limités.
