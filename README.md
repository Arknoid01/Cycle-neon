# Light Cycle Neon

Prototype arcade Light Cycle (Tron / Armagetron) — HTML5 Canvas, sans serveur.

## Lancer le prototype

```bash
# Depuis la racine du repo
python3 -m http.server 8080
```

Ouvrir http://localhost:8080

## Contrôles

- **Mobile** : toucher gauche = tourner à gauche, toucher droite = tourner à droite
- **Desktop** : `A` / `←` = gauche, `D` / `→` = droite, `Espace` = rejouer après game over

## V1 prototype

- Grille, moto, trace persistante, collisions
- Arène carrée avec murs mobiles (2 barres horizontales)
- Score, record local, accélération progressive
- Rendu néon, particules à la mort, restart instantané