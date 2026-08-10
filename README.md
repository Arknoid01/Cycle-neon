# Light Cycle Neon

Prototype arcade Light Cycle (Tron / Armagetron) — un seul fichier HTML, zéro serveur.

## Lancer

Double-cliquer sur `index.html`, ou :

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

Aucun serveur, aucune installation, aucune dépendance.

## Contrôles

- **Mobile** : boutons flèches transparents (style émulateur) en bas à gauche / droite
- **Desktop** : `A` / `←` = gauche, `D` / `→` = droite, `Espace` = rejouer

## V1 prototype

- Grille, moto, trace persistante, collisions
- Arène carrée avec murs mobiles (2 barres horizontales)
- Score, record local, accélération progressive
- Rendu néon, particules à la mort, restart instantané

## Capacitor (plus tard)

Pour publier sur les stores, Capacitor enveloppe ce fichier HTML — toujours sans backend.
