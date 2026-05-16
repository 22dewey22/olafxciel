# OLAFxCIEL

Extension Firefox (Manifest V3) qui intègre les données de planning OLAF directement dans l'interface CIEL, sur `icnagenda.fr/ciel/`.

**Version 0.4.0** — Compatible Firefox 109+

---

## Fonctionnalités

### Comparaison CIEL ↔ OLAF

L'extension récupère les données OLAF avec vos identifiants et colorie les cellules du planning CIEL en fonction de leur cohérence :

**Cellules ALPHA (congé côté CIEL) :**
| Couleur | Signification |
|---|---|
| 🟢 Vert foncé | Validé dans OLAF (statut accordé) |
| 🟡 Orange | En attente dans OLAF (statut envoyé) |
| 🔴 Rouge | Absent d'OLAF |
| 🟣 Violet | Inversion de type (marqué BETA dans OLAF) |

**Cellules BETA (remplacement côté CIEL) :**
| Couleur | Signification |
|---|---|
| 🟢 Vert clair | Présent dans OLAF BETA |
| 🔵 Bleu | Absent de CIEL mais présent dans OLAF |
| 🔴 Rouge | Absent d'OLAF |
| 🟣 Violet | Inversion de type (marqué ALPHA dans OLAF) |

### Astérisques ★ sur les remplacements

Les jours de repos avec remplacement OLAF sont signalés par un astérisque ★ au-dessus de la colonne cycle correspondante. Un tooltip au survol affiche le détail.

### Compteurs automatiques

Lignes de totaux ALPHA et BETA ajoutées en bas du tableau, calculées par jour travaillé selon la configuration du cycle.

### Envoi de congés depuis CIEL

Nouveau module v0.4.0 : posez vos congés directement depuis le panneau, sans quitter CIEL. Les types disponibles sont chargés dynamiquement depuis OLAF selon votre profil et votre affectation courante.

---

## Installation

### Depuis Mozilla Add-ons *(lien à venir)*

1. Rendez-vous sur la page de l'extension
2. Cliquez sur **Ajouter à Firefox**
3. Acceptez les permissions demandées

### Installation manuelle (développeurs)

```bash
git clone https://github.com/22dewey22/olafxciel.git
```

Dans Firefox : `about:debugging` → **Charger un module temporaire** → sélectionner `manifest.json`

---

## Utilisation

### 1. Première ouverture

Ouvrez `https://www.icnagenda.fr/ciel/`. Un panneau apparaît sur la page. Activez les contours avec le toggle **Actif/Inactif**.

### 2. Configurer le cycle de travail

Dans l'onglet **⚙ Settings** :

1. Renseignez la date de votre **J1** (premier jour du cycle)
2. Choisissez la longueur du cycle (6 ou 12 jours)
3. Cochez les jours travaillés (ex : J1, J2, J3, J6, J7, J8)
4. La config est sauvegardée automatiquement

### 3. Charger les données OLAF

1. Entrez vos identifiants OLAF dans le panneau
2. Cochez **Mémoriser** pour sauvegarder le mot de passe (optionnel)
3. Cliquez sur **Charger OLAF**
4. Les contours se mettent à jour

Activez **Auto-chargement** pour recharger automatiquement au changement de mois.

### 4. Poser un congé

1. Cliquez sur **+ Nouveau congé** dans le panneau
2. Sélectionnez le type de congé (chargé depuis votre profil OLAF)
3. Choisissez les dates
4. Cliquez sur **Envoyer**

En cas de collision ou de décompte insuffisant, une popup de confirmation s'affiche avant de valider.

> Le module congés nécessite que vos identifiants soient renseignés dans le panneau. Il est indisponible pour les profils sans congés auto-posables (certains chefs, autres centres).

### 5. Mode apprentissage (optionnel)

Si certaines cellules ne sont pas détectées automatiquement :

1. Dans **⚙ Settings**, sélectionnez **Mode Alpha** ou **Mode Beta**
2. Cliquez sur les cellules à ajouter
3. Repassez en **Mode Normal**

---

## Permissions

| Permission | Usage |
|---|---|
| `storage` | Sauvegarde des préférences (identifiants, config cycle, position du panneau) |
| `tabs`, `activeTab` | Détection du changement de mois dans CIEL |
| `*://www.icnagenda.fr/*` | Accès au planning CIEL |
| `*://olafatco.dsna.aviation-civile.gouv.fr/*` | Connexion à OLAF |

**Vos identifiants ne sont jamais envoyés ailleurs que vers OLAF. Aucune donnée ne quitte votre navigateur.**

---

## FAQ

**Les contours n'apparaissent pas**
Vérifiez que le toggle est sur **Actif**. Rechargez la page CIEL. Assurez-vous d'être sur `www.icnagenda.fr/ciel/`.

**OLAF ne se charge pas**
Vérifiez vos identifiants. Assurez-vous de ne pas avoir de bloqueur de requêtes actif sur le domaine OLAF.

**Le module congés affiche "non disponible"**
Votre profil ne comporte pas de congés auto-posables sur l'affectation courante (chef d'équipe, autre centre, stagiaire en phase TPA…). Utilisez directement l'interface OLAF dans ce cas.

**Un congé n'est pas détecté en ALPHA/BETA**
Utilisez le mode apprentissage pour ajouter manuellement la classe correspondante.

---

## Signaler un bug

- **GitHub Issues** : https://github.com/22dewey22/olafxciel/issues
- **Mozilla Add-ons** : Laissez un avis avec description détaillée

Merci d'inclure : version Firefox, version extension, description du problème, capture d'écran si possible.

---

## Changelog

### v0.4.0
- ✨ Module d'envoi de congés depuis CIEL (types chargés dynamiquement, gestion collisions/décompte)
- ✨ Récupération de l'ID agent via `pageData.php` (plus de comparaison de noms)
- ✨ Position et état du panneau sauvegardés entre sessions
- ♻️ Données OLAF en mémoire (plus de cache storage entre sessions)
- ♻️ Cache agents en mémoire uniquement
- 🐛 Fix `addAsteriskAboveColumn` : alignement positionnel des cellules cycles (robuste quelle que soit la config CIEL)

### v0.3.0
- ✨ Astérisques ★ sur les jours de repos avec remplacement OLAF
- ✨ Tooltip détail au survol des astérisques
- ✨ Dropdown menus CIEL-style pour les settings
- 🐛 Fix URL CIEL (`/ciel/ciel.php?mois=&annee=`)

### v0.2.0
- ✨ Statuts alpha : vert validé / orange en attente / rouge absent
- ✨ Badge pastille colorée dans le coin des cellules
- ✨ Détection agents absents de CIEL mais présents dans OLAF
- ✨ Cache agents avec fetch profil incrémental

### v0.1.0
- ✨ Comparaison CIEL ↔ OLAF avec coloration alpha/beta
- ✨ Cycle de travail configurable (J1, longueur, jours travaillés)
- ✨ Mode apprentissage alpha/beta par clic
- ✨ Totaux par jour en bas du tableau
- ✨ Auto-chargement OLAF au changement de mois

---

## Licence

MIT — voir fichier `LICENSE`.
