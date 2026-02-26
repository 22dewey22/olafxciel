# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Unreleased]

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
