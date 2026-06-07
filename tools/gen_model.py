#!/usr/bin/env python3
"""
Zotov Navigator — OBJ building generator.

Генерирует геометрию оболочки здания Центра «Зотов» (Хлебозавод №5).
Параметры жёстко привязаны к data.sql / building.js, поэтому зоны-оверлеи
(RingGeometry в Three.js) точно совпадают с 3D-оболочкой.

Система координат — как в building.js:
  X — вправо
  Y — вверх
  Z — на зрителя (Three.js default)

Угол зоны:  0° → +X,  90° → -Z (вглубь),  растёт против часовой (CCW сверху)
формула: x = r·cos(θ),  z = -r·sin(θ)

Запуск:
  python tools/gen_model.py
"""
import math, os

PI = math.pi

# ─── Параметры здания — выведены из zotov naked beepo.gltf ─────────────────
# analyze_gltf.py: scale×41, R_outer=20, R_inner=15.14, annex X0=20.8 X1=45
# Здание кольцевое (бывший конвейерный хлебозавод) — не полный цилиндр.

R_MAIN_OUT  = 20.0    # внешний радиус кольца (outer wall)
R_MAIN_IN   = 15.0    # внутренний радиус кольца — из GLTF (≈15.14)

R_STAIR_IN  = 19.5    # лестничная башня, внутренний край
R_STAIR_OUT = 23.0    # лестничная башня, внешний край

# Высоты этажей сохранены из building.js (зоны-оверлеи используют эти же Y)
FLOOR_BASE_Y = {1: 0, 1.5: 8, 2: 12, 2.5: 20, 3: 24, 4: 34}
FLOOR_H      = {1: 4, 1.5: 2, 2: 4,  2.5: 2,  3: 4,  4: 4}

TOTAL_H = 38.0   # крыша (34+4)

# Лестничные/лифтовые башни — (angle_start, angle_end)
STAIR_SECTORS = [
    (194, 222),   # главная башня (лестница + лифт)
    (28,  42),    # вторая лестница
]

# Прямоугольная пристройка — позиция и размер из GLTF-анализа
# (analyze_gltf.py: ANNEX_X0=20.848, X1=45.041, Z=-6.2..+6.3)
ANNEX_X0 = 20.8    # примыкает сразу за внешней стеной (+X направление)
ANNEX_X1 = 45.0    # глубина ~24 единицы
ANNEX_Z0 = -6.3    # ширина ~12.5 единиц
ANNEX_Z1 =  6.3
ANNEX_Y0 = 0
ANNEX_Y1 = 28.0    # крыша пристройки ≈ уровень 3-го этажа

# Плотность сетки: SEG_FULL сегментов на полный круг (360° / SEG_FULL)
SEG_FULL = 72   # шаг 5°

# ─── OBJ-буфер ──────────────────────────────────────────────────────────────
_verts = []   # (x, y, z)
_faces = []   # кортежи 1-based индексов

def V(x, y, z):
    _verts.append((round(x, 6), round(y, 6), round(z, 6)))
    return len(_verts)    # 1-based

def F(*idx):
    _faces.append(idx)

# ─── Геометрические примитивы ───────────────────────────────────────────────

def _xyz(angle_deg, r, y):
    a = angle_deg * PI / 180
    return (r * math.cos(a), y, -r * math.sin(a))

def _arc_verts(r, y, a0, a1, n):
    """n+1 вершин вдоль дуги от a0 до a1 на радиусе r, высоте y."""
    pts = []
    for i in range(n + 1):
        t = i / n if n else 0
        pts.append(V(*_xyz(a0 + t * (a1 - a0), r, y)))
    return pts

def _n(a0, a1):
    """Количество сегментов пропорционально угловому охвату."""
    return max(1, round(abs(a1 - a0) / 360 * SEG_FULL))

def cyl_wall(r, y0, y1, a0, a1, inward=False):
    """Боковая цилиндрическая поверхность (одна дуга, два уровня высоты)."""
    n = _n(a0, a1)
    bot = _arc_verts(r, y0, a0, a1, n)
    top = _arc_verts(r, y1, a0, a1, n)
    for i in range(n):
        if inward:
            F(bot[i+1], top[i+1], top[i], bot[i])
        else:
            F(bot[i], top[i], top[i+1], bot[i+1])

def ring_slab(r_in, r_out, y, a0, a1, flip=False):
    """Горизонтальное кольцо / сектор кольца (перекрытие или крыша)."""
    n = _n(a0, a1)
    outer = _arc_verts(r_out, y, a0, a1, n)
    inner = _arc_verts(r_in,  y, a0, a1, n)
    for i in range(n):
        if flip:
            F(outer[i+1], inner[i+1], inner[i], outer[i])
        else:
            F(outer[i], inner[i], inner[i+1], outer[i+1])

def radial_cap(r_in, r_out, y0, y1, angle_deg):
    """Торцевая стенка секции на заданном угле."""
    bl = V(*_xyz(angle_deg, r_out, y0))
    br = V(*_xyz(angle_deg, r_in,  y0))
    tr = V(*_xyz(angle_deg, r_in,  y1))
    tl = V(*_xyz(angle_deg, r_out, y1))
    F(bl, tl, tr, br)

def sector_shell(r_in, r_out, y0, y1, a0, a1):
    """
    Замкнутая 3D-оболочка кольцевого сектора:
    внешняя стена + внутренняя стена + пол + потолок + 2 торца.
    """
    is_full = abs((a1 - a0) - 360) < 0.5
    cyl_wall(r_out, y0, y1, a0, a1, inward=False)   # внешняя стена
    cyl_wall(r_in,  y0, y1, a0, a1, inward=True)    # внутренняя стена
    ring_slab(r_in, r_out, y0, a0, a1, flip=True)   # пол (нормаль вниз)
    ring_slab(r_in, r_out, y1, a0, a1, flip=False)  # потолок (нормаль вверх)
    if not is_full:
        radial_cap(r_in, r_out, y0, y1, a0)
        radial_cap(r_in, r_out, y0, y1, a1)

def box_shell(x0, x1, z0, z1, y0, y1, slab_ys=()):
    """
    Замкнутый прямоугольный объём (пристройка).
    slab_ys — дополнительные горизонтальные перекрытия внутри.
    Материал DoubleSide в Three.js, поэтому направление нормалей не критично.
    """
    # 4 боковые стены
    F(V(x0,y0,z0), V(x1,y0,z0), V(x1,y1,z0), V(x0,y1,z0))  # перед  (-Z)
    F(V(x0,y0,z1), V(x0,y1,z1), V(x1,y1,z1), V(x1,y0,z1))  # зад    (+Z)
    F(V(x1,y0,z0), V(x1,y0,z1), V(x1,y1,z1), V(x1,y1,z0))  # правая (+X, торец)
    F(V(x0,y0,z0), V(x0,y1,z0), V(x0,y1,z1), V(x0,y0,z1))  # левая  (примыкание)
    # крыша и пол
    F(V(x0,y1,z0), V(x1,y1,z0), V(x1,y1,z1), V(x0,y1,z1))  # крыша
    F(V(x0,y0,z0), V(x0,y0,z1), V(x1,y0,z1), V(x1,y0,z0))  # пол
    # межэтажные плиты
    for y in slab_ys:
        if y0 < y < y1:
            F(V(x0,y,z0), V(x1,y,z0), V(x1,y,z1), V(x0,y,z1))

# ─── Сборка модели ───────────────────────────────────────────────────────────

# 1. Основной цилиндр — непрерывная оболочка от пола до крыши
sector_shell(R_MAIN_IN, R_MAIN_OUT, 0, TOTAL_H, 0, 360)

# 2. Межэтажные перекрытия (горизонтальные кольца внутри цилиндра)
#    Делают видимыми уровни этажей при полупрозрачном рендере
slab_heights = set()
for fn in (1, 2, 3, 4):
    by = FLOOR_BASE_Y[fn]
    h  = FLOOR_H[fn]
    slab_heights.add(by)
    slab_heights.add(by + h)
for y in sorted(slab_heights):
    if 0 < y < TOTAL_H:          # пол/крышу не дублируем
        ring_slab(R_MAIN_IN, R_MAIN_OUT, y, 0, 360)

# 3. Прямоугольная пристройка (+X направление, как в addAnnexZoneMeshes building.js)
#    Межэтажные плиты совпадают с перекрытиями основного здания
box_shell(
    ANNEX_X0, ANNEX_X1,
    ANNEX_Z0, ANNEX_Z1,
    ANNEX_Y0, ANNEX_Y1,
    slab_ys=[4, 12, 24],
)

# 4. Лестничные/лифтовые башни
for (a0, a1) in STAIR_SECTORS:
    sector_shell(R_STAIR_IN, R_STAIR_OUT, 0, TOTAL_H, a0, a1)

# ─── Запись OBJ ─────────────────────────────────────────────────────────────
root     = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
out_path = os.path.join(root, "model", "zotov_building.obj")
srv_path = os.path.join(root, "src", "main", "resources", "static", "models", "zotov-building.obj")

with open(out_path, "w", encoding="utf-8") as f:
    f.write("# Центр «Зотов» — naked building shell\n")
    f.write("# Generated by tools/gen_model.py\n")
    f.write("# R_out=20  R_in=6  H=38  units=Three.js scene units\n")
    f.write("# Floors 1/2/3/4 + mezzanines 1.5/2.5 + stair towers\n")
    f.write(f"# Vertices: {len(_verts)}  Faces: {len(_faces)}\n\n")
    f.write("o ZotovCenter\n\n")
    for x, y, z in _verts:
        f.write(f"v {x} {y} {z}\n")
    f.write("\n")
    for fc in _faces:
        f.write("f " + " ".join(str(i) for i in fc) + "\n")

import shutil
shutil.copy2(out_path, srv_path)

print(f"model/:  {out_path}")
print(f"static/: {srv_path}")
print(f"Vertices: {len(_verts)},  Faces: {len(_faces)}")
