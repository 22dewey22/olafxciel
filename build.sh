#!/usr/bin/env bash
# Construit l'archive de l'extension (même contenu pour Chrome/Edge et Firefox).
#  - Chrome / Edge : dézipper puis « Charger l'extension non empaquetée »,
#    ou charger directement le dossier du dépôt.
#  - Firefox : envoyer le zip sur addons.mozilla.org pour signature (xpi),
#    ou chargement temporaire via about:debugging (manifest.json du dépôt).
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(python3 -c "import json;print(json.load(open('manifest.json'))['version'])")
OUT="dist/olafxciel-${VERSION}.zip"
mkdir -p dist
rm -f "$OUT"
zip -q -r "$OUT" manifest.json background.js icons shared content -x '*.DS_Store' -x '*~'
echo "→ $OUT ($(du -h "$OUT" | cut -f1))"
