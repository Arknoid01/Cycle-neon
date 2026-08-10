# Light Cycle Neon

Jeu arcade Light Cycle — **Three.js / WebGL**, un seul fichier HTML.

## Lancer

Servir via HTTP (Three.js CDN) :

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

Ou double-clic sur `index.html` si le navigateur autorise le CDN.

## Stack

- **Three.js** (WebGL) — rendu GPU, murs 3D, caméra chase
- Logique grille en JS pur (collisions, arènes, score)
- Web Audio procédural
- Capacitor-ready (wrapper mobile plus tard)

## Contrôles

- Flèches transparentes (mobile) ou `A`/`D` (desktop)

## Arènes

Le Battement, Le Compresseur, Le Piège, Le Classique
