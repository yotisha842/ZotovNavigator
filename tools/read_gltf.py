#!/usr/bin/env python3
"""
Читает zotov naked beepo.gltf, декодирует base64-буферы,
извлекает POSITION-вершины каждого меша и выводит:
  - bbox каждого меша
  - общий bbox модели
  - все уникальные Y-уровни (для определения этажей)
  - сохраняет все вершины в read_gltf_verts.txt
"""
import json, base64, struct, math, os, collections

GLTF_PATH = r"D:\ZotovNavigator\model\zotov naked beepo.gltf"
OUT_PATH   = r"D:\ZotovNavigator\tools\read_gltf_verts.txt"

with open(GLTF_PATH, encoding="utf-8") as f:
    gltf = json.load(f)

# ── Декодируем все буферы ───────────────────────────────────────────────────
buffers = []
for buf in gltf["buffers"]:
    uri = buf["uri"]
    b64 = uri.split(",", 1)[1]
    buffers.append(base64.b64decode(b64))

def read_accessor(acc_idx):
    """Возвращает список кортежей (x,y,z) для VEC3-FLOAT32 accessor."""
    acc = gltf["accessors"][acc_idx]
    if acc["type"] != "VEC3" or acc["componentType"] != 5126:  # 5126 = FLOAT
        return []
    bv  = gltf["bufferViews"][acc["bufferView"]]
    buf = buffers[bv["buffer"]]
    offset = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    stride = bv.get("byteStride", 12)  # VEC3 float = 12 bytes default
    count  = acc["count"]
    verts  = []
    for i in range(count):
        pos = offset + i * stride
        x, y, z = struct.unpack_from("<fff", buf, pos)
        verts.append((x, y, z))
    return verts

# ── Собираем вершины по мешам ───────────────────────────────────────────────
all_verts   = []
mesh_bboxes = []

for mi, mesh in enumerate(gltf["meshes"]):
    mesh_verts = []
    for prim in mesh["primitives"]:
        pos_idx = prim.get("attributes", {}).get("POSITION")
        if pos_idx is not None:
            mesh_verts.extend(read_accessor(pos_idx))

    if mesh_verts:
        xs = [v[0] for v in mesh_verts]
        ys = [v[1] for v in mesh_verts]
        zs = [v[2] for v in mesh_verts]
        bbox = (min(xs), max(xs), min(ys), max(ys), min(zs), max(zs))
    else:
        bbox = None

    mesh_bboxes.append(bbox)
    all_verts.extend(mesh_verts)

# ── Глобальный bbox ─────────────────────────────────────────────────────────
gxs = [v[0] for v in all_verts]
gys = [v[1] for v in all_verts]
gzs = [v[2] for v in all_verts]
global_bbox = (min(gxs), max(gxs), min(gys), max(gys), min(gzs), max(gzs))

print(f"Total vertices: {len(all_verts)}")
print(f"Global bbox:")
print(f"  X: {global_bbox[0]:.4f} .. {global_bbox[1]:.4f}  span={global_bbox[1]-global_bbox[0]:.4f}")
print(f"  Y: {global_bbox[2]:.4f} .. {global_bbox[3]:.4f}  span={global_bbox[3]-global_bbox[2]:.4f}")
print(f"  Z: {global_bbox[4]:.4f} .. {global_bbox[5]:.4f}  span={global_bbox[5]-global_bbox[4]:.4f}")

# ── Уникальные Y-уровни (кластеры с шагом 0.001) ───────────────────────────
rounded_ys = sorted(set(round(v[1], 3) for v in all_verts))
print(f"\nUnique Y levels ({len(rounded_ys)} total, showing distinct clusters):")
prev = None
clusters = []
for y in rounded_ys:
    if prev is None or abs(y - prev) > 0.005:
        clusters.append(y)
    prev = y
for y in clusters:
    print(f"  Y={y:.4f}")

# ── bbox каждого меша ───────────────────────────────────────────────────────
print(f"\nMesh bboxes ({len(mesh_bboxes)} meshes):")
for i, bb in enumerate(mesh_bboxes):
    if bb:
        print(f"  mesh[{i:2d}]  X:{bb[0]:.3f}..{bb[1]:.3f}  Y:{bb[2]:.3f}..{bb[3]:.3f}  Z:{bb[4]:.3f}..{bb[5]:.3f}")

# ── Сохраняем все вершины ───────────────────────────────────────────────────
with open(OUT_PATH, "w") as f:
    for x, y, z in all_verts:
        f.write(f"{x:.6f} {y:.6f} {z:.6f}\n")
print(f"\nAll vertices saved to: {OUT_PATH}")
