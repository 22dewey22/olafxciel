# OLAF x CIEL Comparator

Extension Firefox pour comparer automatiquement les plannings CIEL et OLAF avec coloration visuelle des différences.

## 🎯 Fonctionnalités

### ✅ Comparaison automatique CIEL ↔ OLAF
- Connexion à OLAF avec vos identifiants
- Comparaison automatique des congés alpha et beta
- Détection des différences entre les deux systèmes

### 🎨 Coloration visuelle intelligente

**Pour les congés ALPHA :**
- 🟢 **Vert** : Congé présent dans OLAF (conforme)
- 🟡 **Jaune** : Pas encore chargé depuis OLAF
- 🔴 **Rouge** : Présent dans CIEL mais absent d'OLAF
- 🟣 **Violet** : Type inversé (marqué beta dans OLAF)
- 🔵 **Bleu** : Présent dans OLAF mais absent de CIEL

**Pour les congés BETA :**
- 🟢 **Vert clair** : Congé présent dans OLAF (conforme)
- 🔵 **Bleu** : Pas encore chargé depuis OLAF
- 🔴 **Rouge** : Présent dans CIEL mais absent d'OLAF
- 🟣 **Violet** : Type inversé (marqué alpha dans OLAF)
- 🟡 **Jaune** : Présent dans OLAF mais absent de CIEL

### 📊 Compteurs automatiques
- Ligne de total ALPHA en bas du tableau
- Ligne de total BETA en bas du tableau
- Calcul automatique par jour travaillé

### ⚙️ Configuration personnalisable
- **Cycle de travail** : Définissez votre premier jour (J1), la longueur du cycle (6 ou 12 jours), et quels jours sont travaillés
- **Auto-chargement** : Chargement automatique d'OLAF au changement de mois
- **Mémorisation** : Sauvegarde optionnelle des identifiants OLAF
- **Mode apprentissage** : Ajoutez manuellement des classes alpha/beta en cliquant sur les cellules

## 📥 Installation

1. Téléchargez l'extension depuis [Mozilla Add-ons](#) *(lien à venir)*
2. Cliquez sur "Ajouter à Firefox"
3. Acceptez les permissions demandées

### Installation manuelle (développeurs)
```bash
git clone https://github.com/22dewey22/olafxciel.git
```
Puis charger le dossier dans `about:debugging` → "Charger un module temporaire"

## 🚀 Utilisation

### 1. Première utilisation

1. Ouvrez https://www.icnagenda.fr/ciel/
2. Un panneau apparaît à gauche avec l'extension
3. Activez les contours avec le toggle "Actif/Inactif"

### 2. Configurer votre cycle de travail

Dans l'onglet **⚙️ Apprentissage** :
1. Sélectionnez la date de votre J1 (premier jour du cycle)
2. Choisissez la longueur de votre cycle (6 ou 12 jours)
3. Cochez les jours travaillés dans le cycle (ex: J1, J2, J3, J6, J7, J8)
4. La configuration est sauvegardée automatiquement

### 3. Charger les données OLAF

1. Entrez vos identifiants OLAF dans le panneau
2. Cochez "Mémoriser" si vous voulez sauvegarder le mot de passe
3. Cliquez sur "Charger OLAF"
4. Les contours se mettent à jour automatiquement

### 4. Mode apprentissage (optionnel)

Si certaines classes de congés ne sont pas détectées automatiquement :

1. Ouvrez l'onglet **⚙️ Apprentissage**
2. Sélectionnez **Mode Alpha** ou **Mode Beta**
3. Cliquez sur les cellules du planning à ajouter
4. Les classes sont sauvegardées automatiquement
5. Revenez en **Mode Normal** pour utiliser l'extension

## 🔒 Permissions requises

L'extension demande les permissions suivantes :

- **`storage`** : Sauvegarde de vos préférences et configuration
- **`tabs`, `activeTab`** : Détection du changement de mois dans CIEL
- **`*://www.icnagenda.fr/*`** : Accès au planning CIEL
- **`*://olafatco.dsna.aviation-civile.gouv.fr/*`** : Connexion à OLAF

**⚠️ Vos identifiants ne sont jamais envoyés ailleurs que vers OLAF. Ils sont stockés localement dans votre navigateur.**

## ❓ FAQ

### Les contours n'apparaissent pas
- Vérifiez que le toggle "Actif" est bien activé
- Rechargez la page CIEL
- Vérifiez que vous êtes bien sur `www.icnagenda.fr/ciel/`

### OLAF ne se charge pas
- Vérifiez vos identifiants
- Assurez-vous d'avoir une connexion internet
- Vérifiez que vous n'avez pas de bloqueur de publicités qui empêche les requêtes

### Les jours ne correspondent pas
- Vérifiez votre configuration de cycle dans l'onglet "Apprentissage"
- Assurez-vous que la date J1 et les jours travaillés sont corrects

### Un congé n'est pas détecté
- Utilisez le mode apprentissage pour ajouter manuellement la classe
- Mode Alpha/Beta → Cliquez sur la cellule → Mode Normal

## 🐛 Signaler un bug

Vous avez trouvé un bug ? Plusieurs options :

1. **GitHub Issues** : https://github.com/22dewey22/olafxciel/issues
2. **Commentaire sur Mozilla Add-ons** : Laissez un avis détaillé
3. **Email** : *(à ajouter si souhaité)*

Merci d'inclure :
- Version de Firefox
- Version de l'extension
- Description détaillée du problème
- Capture d'écran si possible

## 📝 Changelog

### v0.1.0 (2026-02-23)
- ✨ Système de cycle configurable (date J1 + longueur + jours travaillés)
- ✨ Coloration différenciée pour beta valide (vert clair)
- ✨ Détection des congés présents dans OLAF mais absents de CIEL
- ✨ Type mismatch en violet (alpha ↔ beta inversé)
- ✨ Toggle pour afficher/masquer le mot de passe
- ✨ Exclusion mutuelle alpha/beta automatique
- 🐛 Corrections des totaux pour utiliser la config du cycle
- 🐛 Fallback localStorage pour réseaux d'entreprise restrictifs
- Ajout du mode apprentissage alpha/beta
- Totaux par jour en bas du tableau
- Auto-chargement OLAF au changement de mois
- Comparaison CIEL ↔ OLAF
- Coloration des différences
- Détection et coloration des congés alpha/beta dans CIEL

## 📄 Licence

MIT License - Voir le fichier LICENSE pour plus de détails.

## 🙏 Remerciements

Merci à tous les utilisateurs qui contribuent à améliorer cette extension par leurs retours !

---

