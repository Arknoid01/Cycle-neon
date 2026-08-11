# Modèles moto Blender → GLB

Place tes exports ici : `phantom.glb`, `vanguard.glb`, etc.

## Checklist Blender

1. **Unités** : métrique, échelle 1:1
2. **Orientation** : moto face à **−Z**, roues sur le plan **XZ** (Y = haut)
3. **Pivot** : centre de la moto, roues au sol (Y = 0)
4. **Longueur** : ~1 m (le jeu normalise automatiquement vers ~0.95 unité)

## Empty obligatoire (recommandé)

| Nom | Rôle |
|-----|------|
| `trail_anchor` | Point arrière où la traînée se connecte |

## Empty optionnel

| Nom | Rôle |
|-----|------|
| `emitter` | Mesh émissif arrière (pulse joueur) |

## Noms de matériaux (teinte automatique)

Le jeu colore selon le **nom du material** (minuscules) :

| Slot | Mots-clés dans le nom |
|------|------------------------|
| Carrosserie | `body`, `carrosserie`, `paint`, `hull` |
| Néon | `glow`, `neon`, `strip` |
| Accent / roues | `wheel`, `roue`, `accent`, `canopy` |
| Sombre | `dark`, `chassis`, `frame`, `base` |
| Traînée | `trail`, `emitter`, `trail_glow` |

Utilise des matériaux **Principled BSDF** avec **Emission** pour le néon (Strength 1–3).

## Export GLB

- Format : **glTF Binary (.glb)**
- Inclure : meshes + materials
- Compression Draco : optionnel (&lt; 500 Ko visé)
- Pas besoin d’animation ni de 4 directions

## Fichiers attendus (premium)

```
assets/bikes/phantom.glb
assets/bikes/vanguard.glb
assets/bikes/specter.glb
assets/bikes/inferno.glb
assets/bikes/chrome.glb
assets/bikes/pulse.glb
```

Tant qu’un `.glb` manque, le skin utilise le **kit procédural de secours** (`fallbackKit` dans `bike-skins.js`).
