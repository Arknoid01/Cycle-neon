"""
Cycle Neon — génération procédurale des motos Light Cycle.

Usage :
    blender --background --python tools/blender/generate_bikes.py

Reproductible : la scène est entièrement nettoyée au démarrage, aucun objet
ni matériau ne s'accumule entre deux exécutions.

Convention (voir assets/bikes/README.md, déjà écrite par le projet) :
    - moto face à -Z, Y = haut, roues au sol (Y = 0), pivot au centre
    - longueur cible ~1 m (le jeu renormalise de toute façon vers ~0.95)
    - matériaux nommés body / glow / wheel / dark / trail → teinte
      automatique côté Three.js (bike-model-loader.js, TINT_SLOTS)
    - Empty "trail_anchor" = point d'ancrage de la traînée (arrière)
    - mesh "emitter" = plaque émissive arrière (pulse joueur)

Dans Blender, la scène est construite avec le nez de la moto vers +Y et le
haut vers +Z (convention native Blender). L'export glTF applique la
conversion standard +Y-up : Blender (X, Y, Z) -> glTF (X, Z, -Y). Le nez en
+Y ressort donc bien en -Z côté Three.js, comme l'exige le README.
"""

import bpy
import math
import os
import sys

# ──────────────────────────────────────────────────────────────────────────
# Chemins
# ──────────────────────────────────────────────────────────────────────────

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(SCRIPT_DIR))

# Fichiers réellement référencés par js/bike-skins.js (comblent le manque actuel)
OUT_SKINS_DIR = os.path.join(PROJECT_ROOT, 'assets', 'bikes')
# Silhouettes de base, réutilisables pour de futurs skins
OUT_BASE_DIR = os.path.join(PROJECT_ROOT, 'assets', 'models', 'bikes')
# Fichier .blend de vérification visuelle (GUI)
SHOWCASE_BLEND = os.path.join(SCRIPT_DIR, 'bike_showcase.blend')

os.makedirs(OUT_SKINS_DIR, exist_ok=True)
os.makedirs(OUT_BASE_DIR, exist_ok=True)

# ──────────────────────────────────────────────────────────────────────────
# Silhouettes (dimensions en mètres — longueur le long de +Y, largeur X, hauteur Z)
# ──────────────────────────────────────────────────────────────────────────

SILHOUETTES = {
    'standard': dict(
        length=0.90, width=0.42, height=0.20,
        nose_len=0.30, nose_w=0.24, nose_h=0.12,
        canopy_len=0.26, canopy_w=0.30, canopy_h=0.10,
        wheel_r=0.15, wheel_w=0.06,
    ),
    'interceptor': dict(
        length=0.86, width=0.54, height=0.24,
        nose_len=0.24, nose_w=0.34, nose_h=0.15,
        canopy_len=0.30, canopy_w=0.42, canopy_h=0.13,
        wheel_r=0.18, wheel_w=0.075,
    ),
    'speed': dict(
        length=1.05, width=0.32, height=0.14,
        nose_len=0.42, nose_w=0.16, nose_h=0.08,
        canopy_len=0.20, canopy_w=0.20, canopy_h=0.07,
        wheel_r=0.11, wheel_w=0.05,
    ),
}

# Skins réellement attendus par bike-skins.js — même déclinaisons visuelles
# que leur kit procédural de secours dans bike-builder.js (continuité fallback ↔ GLB).
SKIN_VARIANTS = {
    'chrome':   dict(base='standard',    flavor='chrome'),
    'pulse':    dict(base='standard',    flavor='pulse'),
    'vanguard': dict(base='interceptor', flavor='vanguard'),
    'inferno':  dict(base='interceptor', flavor='inferno'),
    'specter':  dict(base='speed',       flavor='specter'),
    'phantom':  dict(base='speed',       flavor='phantom'),
}

NEON = (0.0, 0.92, 1.0)       # cyan néon par défaut (retouché par Three.js ensuite)
ACCENT = (1.0, 0.55, 0.15)    # accent chaud par défaut


# ──────────────────────────────────────────────────────────────────────────
# Utilitaires scène / matériaux
# ──────────────────────────────────────────────────────────────────────────

def clear_scene():
    """Repart d'une scène vide : aucun objet, mesh, matériau ou empty résiduel."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block_collection in (bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(block_collection):
            block_collection.remove(block)


def make_material(name, base_color, emission_color=None, emission_strength=0.0,
                   metallic=0.35, roughness=0.35, alpha=1.0):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission_color is not None:
        bsdf.inputs['Emission Color'].default_value = (*emission_color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission_strength
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        mat.blend_method = 'BLEND'
    return mat


def make_bike_materials(prefix):
    """Un jeu de matériaux par moto (noms distincts pour éviter tout partage
    accidentel entre fichiers exportés séparément)."""
    return {
        'dark':  make_material(f'{prefix}_dark_chassis', (0.03, 0.03, 0.05),
                                emission_color=NEON, emission_strength=0.15,
                                metallic=0.4, roughness=0.5),
        'body':  make_material(f'{prefix}_body_paint', (0.08, 0.08, 0.12),
                                emission_color=NEON, emission_strength=0.4,
                                metallic=0.5, roughness=0.3),
        'wheel': make_material(f'{prefix}_wheel_accent', (0.05, 0.05, 0.07),
                                emission_color=ACCENT, emission_strength=0.8,
                                metallic=0.6, roughness=0.25),
        'glow':  make_material(f'{prefix}_glow_neon', (0.0, 0.0, 0.0),
                                emission_color=NEON, emission_strength=3.0,
                                metallic=0.0, roughness=0.1),
        'trail': make_material(f'{prefix}_trail_emitter', (0.0, 0.0, 0.0),
                                emission_color=ACCENT, emission_strength=3.5,
                                metallic=0.0, roughness=0.1),
    }


def add_box(name, size, location, mat, parent, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def add_cylinder(name, radius, depth, location, mat, parent, rotation=(0, 0, 0), verts=14):
    bpy.ops.mesh.primitive_cylinder_add(
        radius=radius, depth=depth, vertices=verts, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def add_torus(name, major_r, minor_r, location, mat, parent, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_r, minor_radius=minor_r,
        major_segments=16, minor_segments=8, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def add_cone(name, radius, depth, location, mat, parent, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(
        radius1=radius, radius2=0.0, depth=depth, vertices=8, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = rotation
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def add_sphere(name, radius, location, mat, parent, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius, segments=12, ring_count=8, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    obj.parent = parent
    return obj


def add_empty(name, location, parent, size=0.05):
    bpy.ops.object.empty_add(type='PLAIN_AXES', radius=size, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.parent = parent
    return obj


# ──────────────────────────────────────────────────────────────────────────
# Construction d'une moto
# ──────────────────────────────────────────────────────────────────────────

def build_bike(dims, flavor, root_name='Bike'):
    """Construit une moto complète et renvoie l'objet racine (Empty)."""
    bpy.ops.object.empty_add(type='PLAIN_AXES', radius=0.05, location=(0, 0, 0))
    root = bpy.context.active_object
    root.name = root_name

    mats = make_bike_materials(f'{root_name}_{flavor}')

    L, W, H = dims['length'], dims['width'], dims['height']
    nose_len, nose_w, nose_h = dims['nose_len'], dims['nose_w'], dims['nose_h']
    canopy_len, canopy_w, canopy_h = dims['canopy_len'], dims['canopy_w'], dims['canopy_h']
    wheel_r, wheel_w = dims['wheel_r'], dims['wheel_w']

    ground = wheel_r  # les roues touchent Z=0, tout le reste est offset au-dessus

    # Châssis principal (sombre)
    add_box('chassis', (W, L, H * 0.55), (0, 0, ground + H * 0.30), mats['dark'], root)

    # Nez (avant, +Y)
    nose_z = ground + H * 0.34
    if flavor == 'specter':
        # nez bifide : deux blocs décalés de part et d'autre de l'axe
        add_box('body_nose_l', (nose_w * 0.42, nose_len, nose_h),
                (-nose_w * 0.27, L * 0.5 + nose_len * 0.35, nose_z), mats['body'], root)
        add_box('body_nose_r', (nose_w * 0.42, nose_len, nose_h),
                (nose_w * 0.27, L * 0.5 + nose_len * 0.35, nose_z), mats['body'], root)
    else:
        add_box('body_nose', (nose_w, nose_len, nose_h),
                (0, L * 0.5 + nose_len * 0.35, nose_z), mats['body'], root)

    # Canopy / accent central
    canopy_z = ground + H * 0.62
    if flavor == 'pulse':
        add_sphere('canopy_wheel', canopy_w * 0.36, (0, L * 0.06, canopy_z + 0.03),
                   mats['wheel'], root, scale=(1.0, 0.85, 0.7))
    else:
        cw = canopy_w * (0.62 if flavor == 'specter' else 1.0)
        add_box('canopy_wheel', (cw, canopy_len, canopy_h),
                (0, L * 0.06, canopy_z), mats['wheel'], root)

    # Bandeau lumineux central (glow)
    add_box('glow_strip_roof', (W * 0.94, canopy_len * 0.5, 0.02),
            (0, L * 0.06, canopy_z + canopy_h * 0.5 + 0.015), mats['glow'], root)

    # Bandeaux latéraux (glow) — absents sur Chrome (finition minimaliste)
    if flavor != 'chrome':
        side_x = W * 0.5 + 0.015
        strip_z = ground + H * 0.34
        for sign in (-1, 1):
            add_box('glow_strip_side', (0.02, L * 0.62, H * 0.28),
                    (sign * side_x, -L * 0.02, strip_z), mats['glow'], root)

    # Roues (gauche/droite)
    wheel_y = L * 0.22
    for sign, side in ((-1, 'l'), (1, 'r')):
        if flavor == 'phantom':
            add_torus(f'wheel_{side}', wheel_r, wheel_w * 0.45,
                      (sign * (W * 0.5), wheel_y, wheel_r),
                      mats['wheel'], root, rotation=(0, math.radians(90), 0))
        else:
            add_cylinder(f'wheel_{side}', wheel_r, wheel_w,
                         (sign * (W * 0.5), wheel_y, wheel_r),
                         mats['wheel'], root, rotation=(0, 0, math.radians(90)))

    # Soubassement / traînée (trail)
    add_box('trail_underglow', (W * 0.8, L * 0.7, 0.015),
            (0, -L * 0.02, ground * 0.4), mats['trail'], root)

    # Plaque émissive arrière + ancrage de traînée (-Y = arrière)
    rear_y = -L * 0.5 - 0.02
    rear_z = ground + H * 0.32
    add_box('emitter', (nose_w * 0.7, 0.08, nose_h * 0.9),
            (0, rear_y, rear_z), mats['trail'], root)
    add_empty('trail_anchor', (0, rear_y - 0.05, rear_z), root, size=0.04)

    # ── Déclinaisons par flavor ──────────────────────────────────────────
    if flavor == 'chrome':
        mats['body'].node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = 0.95
        mats['body'].node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.06
        mats['body'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 0.15

    elif flavor == 'vanguard':
        spread = W * 0.62
        for sign in (-1, 1):
            add_box('wheel_pylon', (0.05, 0.10, H * 1.7),
                    (sign * spread, L * 0.02, ground + H * 0.85), mats['glow'], root)
            add_box('wheel_pylon_cap', (0.09, 0.12, 0.05),
                    (sign * spread, L * 0.02, ground + H * 1.75), mats['wheel'], root)

    elif flavor == 'inferno':
        spike_z = ground + H * 0.5
        spike_y = L * 0.5 + nose_len * 0.55
        for sign in (-1, 1):
            add_cone('wheel_spike', 0.045, 0.20,
                     (sign * nose_w * 0.55, spike_y - 0.05, spike_z),
                     mats['wheel'], root,
                     rotation=(math.radians(80), 0, sign * math.radians(18)))

    elif flavor == 'specter':
        fin_z = ground + H * 0.34
        add_box('glow_fin', (0.035, 0.30, H * 1.4),
                (0, -L * 0.08, fin_z + H * 0.55), mats['glow'], root)

    # phantom : déjà couvert par les roues en anneau ci-dessus
    if flavor == 'phantom':
        mats['glow'].node_tree.nodes['Principled BSDF'].inputs['Emission Strength'].default_value = 4.0

    # ── Nettoyage des transformations : tout est déjà "appliqué" par construction,
    #    seul l'Empty racine reste à l'origine avec une transformation identité.
    bpy.ops.object.select_all(action='DESELECT')
    return root


def select_hierarchy(root):
    bpy.ops.object.select_all(action='DESELECT')

    def _select(obj):
        obj.select_set(True)
        for child in obj.children:
            _select(child)
    _select(root)
    bpy.context.view_layer.objects.active = root


def export_glb(root, filepath):
    select_hierarchy(root)
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        use_selection=True,
        export_format='GLB',
        export_materials='EXPORT',
        export_apply=True,
        export_yup=True,
        export_lights=False,
        export_cameras=False,
        export_animations=False,
        export_extras=False,
    )
    size_kb = os.path.getsize(filepath) / 1024
    print(f'[generate_bikes] exporté {filepath} ({size_kb:.1f} Ko)')


def delete_hierarchy(root):
    select_hierarchy(root)
    bpy.ops.object.delete(use_global=False)


# ──────────────────────────────────────────────────────────────────────────
# Scène de vérification (fond sombre, éclairage simple, caméra de présentation)
# ──────────────────────────────────────────────────────────────────────────

def build_showcase_scene():
    bpy.context.scene.world = bpy.data.worlds.new('NeonVoid')
    bpy.context.scene.world.use_nodes = True
    bg = bpy.context.scene.world.node_tree.nodes.get('Background')
    if bg:
        bg.inputs['Color'].default_value = (0.005, 0.006, 0.01, 1.0)
        bg.inputs['Strength'].default_value = 1.0

    bpy.ops.object.light_add(type='AREA', location=(1.5, -1.0, 1.8))
    key = bpy.context.active_object
    key.data.energy = 400
    key.data.color = (0.5, 0.9, 1.0)

    bpy.ops.object.light_add(type='AREA', location=(-1.6, 1.2, 0.6))
    rim = bpy.context.active_object
    rim.data.energy = 250
    rim.data.color = (1.0, 0.4, 0.8)

    bpy.ops.object.camera_add(location=(1.8, -2.4, 1.1),
                               rotation=(math.radians(78), 0, math.radians(37)))
    cam = bpy.context.active_object
    bpy.context.scene.camera = cam

    x_offset = -1.3
    roots = []
    for name in ('standard', 'interceptor', 'speed'):
        root = build_bike(SILHOUETTES[name], flavor=(
            'chrome' if name == 'standard' else 'vanguard' if name == 'interceptor' else 'phantom'
        ), root_name=f'Showcase_{name}')
        root.location.x = x_offset
        x_offset += 1.3
        roots.append(root)
    return roots


# ──────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────

def main():
    clear_scene()

    # 1) Les 6 skins réellement câblés dans bike-skins.js (comble le manque actuel)
    for skin_id, variant in SKIN_VARIANTS.items():
        dims = SILHOUETTES[variant['base']]
        root = build_bike(dims, variant['flavor'], root_name='Bike')
        out_path = os.path.join(OUT_SKINS_DIR, f'{skin_id}.glb')
        export_glb(root, out_path)
        delete_hierarchy(root)

    # 2) Les 3 silhouettes de base "propres", réutilisables pour de futurs skins
    BASE_FLAVOR = {'standard': 'chrome', 'interceptor': 'vanguard', 'speed': 'phantom'}
    for sil_name, dims in SILHOUETTES.items():
        root = build_bike(dims, BASE_FLAVOR[sil_name], root_name='Bike')
        out_path = os.path.join(OUT_BASE_DIR, f'bike_{sil_name}.glb')
        export_glb(root, out_path)
        delete_hierarchy(root)

    # 3) Scène de vérification visuelle, sauvegardée en .blend (mode GUI)
    clear_scene()
    build_showcase_scene()
    bpy.ops.wm.save_as_mainfile(filepath=SHOWCASE_BLEND)
    print(f'[generate_bikes] scène de vérification sauvegardée : {SHOWCASE_BLEND}')

    print('[generate_bikes] terminé.')


if __name__ == '__main__':
    main()
