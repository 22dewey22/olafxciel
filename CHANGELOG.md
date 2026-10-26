# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

## [0.5.0] - 2026-10-26

### Changed
- **Compatibilité ECLAIR** : CIEL est devenu ECLAIR (`uciel.php`, période libre rechargée en AJAX). L'extension cible la nouvelle page, lit les dates et les numéros de cycle directement dans le cahier (`data-date`, `data-ciel-jc`) et se réapplique à chaque rechargement de grille (`uciel:grid-updated`).
- **Manifest V3 commun Chrome / Edge / Firefox** (Firefox ≥ 121). Les appels OLAF passent par un script d'arrière-plan (CORS).
- **OLAF via la session du navigateur** : si vous êtes connecté à OLAF dans un onglet, aucun identifiant n'est nécessaire. Les identifiants restent possibles en option.
- **Cycle de travail lu dans ECLAIR** : plus de date J1 ni de longueur à saisir, seuls les jours comptés comme travaillés restent modifiables.
- **Cases fusionnées** : l'extension défusionne/refusionne les sigles via les hooks d'ECLAIR pour peindre chaque jour.
- **Nouvelle interface** du panneau (état de connexion OLAF, légende, volet paramètres).
- Pont de détection ECLAIR : l'extension se déclare à la page (bandeau « OLAF Check » pour les rôles qui le voient).

### Removed
- Lignes de totaux ALPHA/BETA (ECLAIR affiche désormais ses propres lignes α/β).
- Client cycle OLAF (`getCycle.php`), parseur de libellé de mois.

## [0.4.0] - 2026-05-16
- **Ajout du module d'envoi de congé** : Module à priori fonctionnel, va falloir tester

## [0.3.2] - 2026-05-16
- **Modif local storage** : Retrait de la plupart des trucs, pour éviter que cela casse si le storage ne marche pas (à tester chez D.G.)

## [0.3.0] - 2026-03-18

### Fixed
- **Extension cassée** : Rework de l'extension suite a MaJ de ciel qui a tout casse
- **Design** : Nouveau design plus sobre
- **Rempla display** : Bug suite a MaJ ciel

## [0.2.3] - 2026-03-18

### Fixed
- **PR B.G.** : Gestion des caractères exotiques pour requête vers Olaf
- **Manifest.json** : Adaptation à la maj de Ciel (changement d'url dans la nav)

## [0.2.0] - 2026-02-25

### Added
- **Demandes de remplacement** : Affichage des demandes de remplacement directement sur le planning avec des astérisques (★) au-dessus des jours concernés
- **Tooltip interactif** : Survol des astérisques pour afficher les détails des remplacements (nom, prénom, vacation, équipe)
- **Filtrage intelligent** : Les astérisques n'apparaissent que pour les jours de repos (basé sur la configuration du cycle de travail)
- **Rafraîchissement automatique** : Mise à jour des astérisques lors du changement de configuration du cycle
- **Badges de statut généralisés** : Tous les types d'outline (alpha validés, en attente, beta, missing) affichent maintenant des badges colorés

### Fixed
- **Matcher de noms composés** : Correction du bug sur les noms avec tirets et espaces
- **Normalisation des tirets** : Les espaces autour des tirets dans les noms sont maintenant nettoyés automatiquement

### Changed
- **Système de badges** : Extension des badges visuels à tous les types d'outline pour une meilleure lisibilité
- **Position des astérisques** : Positionnement relatif au tableau pour un meilleur comportement au scroll
- **Activation limitée** : L'extension ne s'active maintenant que sur les pages de planning mensuel

## [0.1.0] - 2026-02-23

### Added
- Version initiale de l'extension
- Comparaison OLAF ↔ CIEL
- Contours colorés pour les différences
- Panel de configuration
- Auto-chargement OLAF
- Configuration du cycle de travail
