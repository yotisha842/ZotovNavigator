#!/usr/bin/env python3
"""
РђРЅР°Р»РёР·РёСЂСѓРµС‚ zotov naked beepo.gltf:
- РЅР°С…РѕРґРёС‚ С†РµРЅС‚СЂ С†РёР»РёРЅРґСЂР° Рё СЂР°РґРёСѓСЃС‹ (outer/inner) РїРѕ РІРµСЂС€РёРЅР°Рј
- РѕРїСЂРµРґРµР»СЏРµС‚ Y-СѓСЂРѕРІРЅРё СЌС‚Р°Р¶РµР№
- РѕРїСЂРµРґРµР»СЏРµС‚ РїР°СЂР°РјРµС‚СЂС‹ РїСЂРёСЃС‚СЂРѕР№РєРё
- РІС‹РІРѕРґРёС‚ РіРѕС‚РѕРІС‹Рµ РєРѕРЅСЃС‚Р°РЅС‚С‹ РґР»СЏ gen_model.py
"""
import json, base64, struct, math, statistics

GLTF_PATH = r"D:\ZotovNavigator\model\zotov naked beepo.gltf"

with open(GLTF_PATH, encoding="utf-8") as f:
    gltf = json.load(f)

buffers = []
for buf in gltf["buffers"]:
    b64 = buf["uri"].split(",", 1)[1]
    buffers.append(base64.b64decode(b64))

def read_accessor(acc_idx):
    acc = gltf["accessors"][acc_idx]
    if acc["type"] != "VEC3" or acc["componentType"] != 5126:
        return []
    bv     = gltf["bufferViews"][acc["bufferView"]]
    buf    = buffers[bv["buffer"]]
    offset = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = bv.get("byteStride", 12)
    verts  = []
    for i in range(acc["count"]):
        x, y, z = struct.unpack_from("<fff", buf, offset + i * stride)
        verts.append((x, y, z))
    return verts

# РЎРѕР±РёСЂР°РµРј РІСЃРµ РІРµСЂС€РёРЅС‹
all_verts = []
for mesh in gltf["meshes"]:
    for prim in mesh["primitives"]:
        pos_idx = prim.get("attributes", {}).get("POSITION")
        if pos_idx is not None:
            all_verts.extend(read_accessor(pos_idx))

xs = [v[0] for v in all_verts]
ys = [v[1] for v in all_verts]
zs = [v[2] for v in all_verts]

print(f"Total vertices: {len(all_verts)}")
print(f"Global  X: {min(xs):.4f} .. {max(xs):.4f}")
print(f"        Y: {min(ys):.4f} .. {max(ys):.4f}")
print(f"        Z: {min(zs):.4f} .. {max(zs):.4f}")

# в”Ђв”Ђ 1. РћС†РµРЅРёС‚СЊ С†РµРЅС‚СЂ С†РёР»РёРЅРґСЂР° в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Р¦РёР»РёРЅРґСЂ РІРёРґРёС‚ С‚РѕР»СЊРєРѕ X<1.2 (РїСЂРёСЃС‚СЂРѕР№РєР° РїСЂР°РІРµРµ). Р‘РµСЂС‘Рј РІРµСЂС€РёРЅС‹ Р»РµРІРѕР№ С‡Р°СЃС‚Рё.
cyl_verts = [(x, y, z) for x, y, z in all_verts if x < 1.15]
cx_raw = (min(v[0] for v in cyl_verts) + max(v[0] for v in cyl_verts)) / 2
cz_raw = (min(v[2] for v in cyl_verts) + max(v[2] for v in cyl_verts)) / 2
print(f"\nCylinder raw center estimate: X={cx_raw:.4f}  Z={cz_raw:.4f}")

# Р’С‹С‡РёСЃР»СЏРµРј СЂР°СЃСЃС‚РѕСЏРЅРёСЏ РѕС‚ С†РµРЅС‚СЂР° РґР»СЏ РІСЃРµС… РІРµСЂС€РёРЅ С†РёР»РёРЅРґСЂР°
dists = [math.sqrt((v[0]-cx_raw)**2 + (v[2]-cz_raw)**2) for v in cyl_verts]
dists_sorted = sorted(set(round(d,3) for d in dists))

# РљР»Р°СЃС‚РµСЂРёР·СѓРµРј СЂР°СЃСЃС‚РѕСЏРЅРёСЏ в†’ РёС‰РµРј outer Рё inner СЂР°РґРёСѓСЃ
clusters = []
prev = None
for d in dists_sorted:
    if prev is None or d - prev > 0.015:
        clusters.append([d])
    else:
        clusters[-1].append(d)
    prev = d

print(f"\nRadius clusters from cylinder center ({len(clusters)} groups):")
for c in clusters:
    print(f"  r={min(c):.4f}..{max(c):.4f}  (median {statistics.median(c):.4f}, n={len(c)})")

# Р’С‹Р±РёСЂР°РµРј outer Рё inner СЂР°РґРёСѓСЃС‹ (СЃР°РјС‹Р№ Р±РѕР»СЊС€РѕР№ Рё РІС‚РѕСЂРѕР№)
top_clusters = sorted(clusters, key=lambda c: statistics.median(c), reverse=True)
R_outer_raw = statistics.median(top_clusters[0])
R_inner_raw = statistics.median(top_clusters[1]) if len(top_clusters) > 1 else R_outer_raw * 0.3
print(f"\nв†’ R_outer (model) = {R_outer_raw:.4f}")
print(f"в†’ R_inner (model) = {R_inner_raw:.4f}")

# в”Ђв”Ђ 2. Scale factor в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Р’ Three.js R_outer = 20
SCALE = 20.0 / R_outer_raw
print(f"\nScale factor (modelв†’Three.js): {SCALE:.2f}Г—")

def to_threejs(val):
    return round(val * SCALE, 3)

# в”Ђв”Ђ 3. Р’С‹СЃРѕС‚Р° Р·РґР°РЅРёСЏ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
y_min = min(ys)
y_max = max(ys)
# Y=0 РІ РјРѕРґРµР»Рё = РїРѕР» 1-РіРѕ СЌС‚Р°Р¶Р° (ground level)
total_h_model = y_max - max(y_min, 0)
print(f"\nBuilding height: {y_min:.4f}..{y_max:.4f}")
print(f"в†’ Total height (Three.js) = {to_threejs(total_h_model):.1f}")

# в”Ђв”Ђ 4. РЈСЂРѕРІРЅРё СЌС‚Р°Р¶РµР№ (РєР»Р°СЃС‚РµСЂС‹ РїР»РѕСЃРєРёС… РіРѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹С… РІРµСЂС€РёРЅ) в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
# Р“РѕСЂРёР·РѕРЅС‚Р°Р»СЊРЅС‹Рµ РїР»РёС‚С‹ вЂ” РІРµСЂС€РёРЅС‹ РіРґРµ РјРЅРѕРіРѕ С‚РѕС‡РµРє РЅР° РѕРґРЅРѕРј Y
from collections import Counter
y_rounded = Counter(round(y, 3) for y in ys)

print(f"\nY levels with many vertices (potential floor slabs):")
for y_val, cnt in sorted(y_rounded.items()):
    if cnt >= 6:
        print(f"  Y={y_val:.4f} (count={cnt})  в†’ Three.js Y={to_threejs(y_val - max(y_min,0)):.2f}")

# в”Ђв”Ђ 5. РџСЂРёСЃС‚СЂРѕР№РєР° в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
annex_verts = [(x, y, z) for x, y, z in all_verts if x > cx_raw + R_outer_raw + 0.02]
if annex_verts:
    ax = [v[0] for v in annex_verts]
    az = [v[2] for v in annex_verts]
    print(f"\nAnnex vertices: {len(annex_verts)}")
    print(f"  X: {min(ax):.4f} .. {max(ax):.4f}")
    print(f"  Z: {min(az):.4f} .. {max(az):.4f}")
    annex_x0 = to_threejs(min(ax) - cx_raw)
    annex_x1 = to_threejs(max(ax) - cx_raw)
    annex_z0 = to_threejs(min(az) - cz_raw)
    annex_z1 = to_threejs(max(az) - cz_raw)
    print(f"\nв†’ ANNEX_X0={annex_x0}  ANNEX_X1={annex_x1}")
    print(f"в†’ ANNEX_Z0={annex_z0}  ANNEX_Z1={annex_z1}")
    print(f"в†’ depth={annex_x1-annex_x0:.1f}  width={annex_z1-annex_z0:.1f}")
else:
    print("\nNo annex vertices found beyond cylinder")

# в”Ђв”Ђ 6. Р›РµСЃС‚РЅРёС‡РЅР°СЏ Р±Р°С€РЅСЏ в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ
stair_verts = [(x, y, z) for x, y, z in all_verts
               if math.sqrt((x-cx_raw)**2 + (z-cz_raw)**2) > R_outer_raw + 0.01
               and x < cx_raw + R_outer_raw + 0.1]
if stair_verts:
    sx = [v[0] for v in stair_verts]
    sz = [v[2] for v in stair_verts]
    # РЈРіРѕР» РІ СЃРёСЃС‚РµРјРµ РєРѕРѕСЂРґРёРЅР°С‚ building.js
    def angle(x, z, cx, cz):
        a = math.degrees(math.atan2(-(z - cz), x - cx))
        return a % 360
    angles = [angle(v[0], v[2], cx_raw, cz_raw) for v in stair_verts]
    print(f"\nStair tower angles: {min(angles):.1f}В° .. {max(angles):.1f}В°")
    sr_min = min(math.sqrt((v[0]-cx_raw)**2 + (v[2]-cz_raw)**2) for v in stair_verts)
    sr_max = max(math.sqrt((v[0]-cx_raw)**2 + (v[2]-cz_raw)**2) for v in stair_verts)
    print(f"  R: {to_threejs(sr_min):.2f} .. {to_threejs(sr_max):.2f}")

print(f"\nR_inner (Three.js) = {to_threejs(R_inner_raw):.2f}")

