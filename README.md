# OLAFxCIEL

Extension navigateur (Manifest V3, Chrome / Edge / Firefox) qui intègre les données de planning OLAF directement dans le cahier CIEL / ECLAIR, sur `icnagenda.fr/ciel/`.

**Version 0.5.0** — Compatible Chrome / Edge et Firefox 121+

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

### Compteurs

ECLAIR affiche désormais nativement ses lignes α et β dans l'entête du cahier : l'extension ne les duplique plus.

### Envoi de congés depuis CIEL

Posez vos congés directement depuis le panneau, sans quitter CIEL. Les types disponibles sont chargés dynamiquement depuis OLAF selon votre profil et votre affectation courante.

### Connexion OLAF

Deux possibilités, au choix :

- **Session navigateur** (recommandé) : connectez-vous à OLAF dans un onglet, l'extension réutilise cette session. Aucun identifiant à saisir.
- **Identifiants dans le panneau** : login et mot de passe OLAF, mémorisables. Ils ne quittent jamais votre navigateur.

---

## Installation

### Chrome / Edge

1. Téléchargez l'archive `dist/olafxciel-x.y.z.zip` (ou clonez le dépôt) et dézippez-la
2. Ouvrez `chrome://extensions` (ou `edge://extensions`), activez le **mode développeur**
3. **Charger l'extension non empaquetée** → sélectionnez le dossier contenant `manifest.json`

### Firefox

- Version signée : fichier `.xpi` fourni dans les releases (ou Mozilla Add-ons)
- Test : `about:debugging#/runtime/this-firefox` → **Charger un module complémentaire temporaire** → `manifest.json`

### Depuis les sources

```bash
git clone https://github.com/22dewey22/olafxciel.git
cd olafxciel && ./build.sh   # → dist/olafxciel-<version>.zip
```

---

## Utilisation

### 1. Première ouverture

Ouvrez `https://www.icnagenda.fr/ciel/`. Un panneau apparaît sur la page. Activez les contours avec le toggle **Actif/Inactif**.

### 2. Cycle de travail

Le cycle (J1, longueur, jours travaillés) est lu directement dans ECLAIR. Dans **⚙ Paramètres**, vous pouvez seulement changer les jours comptés comme travaillés, et revenir à la config ECLAIR d'un clic.

### 3. Charger les données OLAF

1. Connectez-vous à OLAF dans un onglet (bouton **Ouvrir OLAF**), ou saisissez vos identifiants dans le panneau
2. Cliquez sur **Charger OLAF**
3. Les contours se mettent à jour pour toute la période affichée, même sur plusieurs mois

**Recharger au changement de période** (activé par défaut) recharge OLAF automatiquement quand vous changez la période dans ECLAIR.

### 4. Poser un congé

1. Cliquez sur **+ Nouveau congé** dans le panneau
2. Sélectionnez le type de congé (chargé depuis votre profil OLAF)
3. Choisissez les dates
4. Cliquez sur **Envoyer**

En cas de collision ou de décompte insuffisant, une popup de confirmation s'affiche avant de valider.

> Le module congés nécessite que vos identifiants soient renseignés dans le panneau. Il est indisponible pour les profils sans congés auto-posables (certains chefs, autres centres).

### 5. Mode apprentissage (optionnel)

Si certaines cellules ne sont pas détectées automatiquement :

1. Dans **⚙ Paramètres**, sélectionnez **Congé** ou **Stage**
2. Cliquez sur les cases du cahier à associer à ce type
3. Repassez en **Normal**

---

## Permissions

| Permission | Usage |
|---|---|
| `storage` | Sauvegarde des préférences (identifiants optionnels, jours travaillés, position du panneau) |
| `*://www.icnagenda.fr/ciel/*` | Accès au cahier CIEL / ECLAIR |
| `*://olafatco.dsna.aviation-civile.gouv.fr/*` | Appels OLAF depuis le script d'arrière-plan |

**Vos identifiants ne sont jamais envoyés ailleurs que vers OLAF. Aucune donnée ne quitte votre navigateur.**

---

## FAQ

**Les contours n'apparaissent pas**
Vérifiez que le toggle est sur **Actif**. Rechargez la page CIEL. Assurez-vous d'être sur `www.icnagenda.fr/ciel/uciel.php`.

**OLAF « non connecté »**
Ouvrez OLAF dans un onglet et connectez-vous, puis cliquez **Tester**. Sinon saisissez vos identifiants dans le panneau. Vérifiez l'absence de bloqueur de requêtes sur le domaine OLAF.

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

### v0.5.0
- ✨ Compatibilité ECLAIR (`uciel.php`, période libre, rechargement AJAX)
- ✨ Manifest V3 commun Chrome / Edge / Firefox, appels OLAF via le script d'arrière-plan
- ✨ OLAF via la session du navigateur, identifiants optionnels
- ✨ Cycle lu dans ECLAIR, nouvelle interface du panneau
- 🗑️ Lignes de totaux (ECLAIR affiche ses propres lignes α/β)

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
