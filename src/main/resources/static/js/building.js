// 3D-модель здания из примитивов: 5 цилиндров-этажей + секторные зоны (RingGeometry).
// ВРЕМЕННО: финальную детализированную модель подставят 3D-моделлеры —
// функции zoneCenterWorld() / getZoneData() / индексы зон останутся теми же.
import * as THREE from 'three';
import { scene, COLORS } from './scene.js';

const deg2rad = (d) => (d * Math.PI) / 180;

// Абсолютные Y-координаты оснований уровней (в метрах).
// Увеличенные зазоры между этажами (~8 м) для наглядности маршрутов:
//   Эт.1:  y=0–4   → зазор 8 м → Антр.1½: y=8–10  → Эт.2: y=12–16
//   Эт.2:  y=12–16 → зазор 8 м → Пер.2½:  y=20–22 → Эт.3: y=24–28
//   Эт.3:  y=24–28 → зазор 10 м (без пристройки)  → Эт.4: y=34–38
const FLOOR_BASE_Y = new Map([
    [1,   0],
    [1.5, 8],
    [2,   12],
    [2.5, 20],
    [3,   24],
    [4,   34],
]);

// Угловой сектор и радиусы пристройки (башня лестницы + антресоль).
// Совпадает с расположением зон STAIRS/ELEVATOR в data.sql (~194–222°)
// и расширяется по обе стороны для объёма.
const ANNEX_A_START = 140; // °
const ANNEX_A_END   = 350; // °
const ANNEX_R_INNER = 19;  // м
const ANNEX_R_OUTER = 27.5;// м

export const building = new THREE.Group();
building.name = 'building';
scene.add(building);

const floorGroups = new Map();   // number -> THREE.Group
const floorMeta = new Map();     // number -> { baseY, height, radius }
const zoneMeshes = [];           // для Raycaster
const zoneIndex = new Map();     // zoneId -> { data, mesh, center: Vector3, baseColor, floorNumber }

let maxFloor = 1;

/** Основание уровня в мировых координатах — берётся из таблицы, fallback — формула. */
function floorBaseY(number) {
    return FLOOR_BASE_Y.get(number) ?? (number - 1) * 7;
}

/** true, если уровень является антресолью/пристройкой (не целый номер этажа). */
function isMezzanine(number) { return !Number.isInteger(number); }

/** Построить здание по данным этажей и зон. */
export function buildBuilding(floors, zones) {
    clear();
    const byFloor = new Map();
    for (const z of zones) {
        if (!byFloor.has(z.floorNumber)) byFloor.set(z.floorNumber, []);
        byFloor.get(z.floorNumber).push(z);
    }

    for (const floor of floors) {
        maxFloor = Math.max(maxFloor, floor.number);
        const height = floor.heightMeters || 4;
        const radius = floor.radiusMeters || 20;
        const baseY  = floorBaseY(floor.number);
        floorMeta.set(floor.number, { baseY, height, radius });

        const group = new THREE.Group();
        group.userData.floorNumber = floor.number;
        floorGroups.set(floor.number, group);
        building.add(group);

        if (isMezzanine(floor.number)) {
            // ── Антресоль / пристройка ──────────────────────────────────────
            // Геометрия крыла (стены, пол) рисуется addAnnexForFloor ниже.
            // Зоны рисуются как прямоугольные плиты через addAnnexZoneMeshes.

        } else {
            // ── Основной цилиндрический этаж ────────────────────────────────
            // Диск-перекрытие
            const disk = new THREE.Mesh(
                new THREE.CircleGeometry(radius, 64),
                new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.95, metalness: 0 })
            );
            disk.rotation.x = -Math.PI / 2;
            disk.position.y = baseY;
            disk.receiveShadow = true;
            group.add(disk);

            // Полупрозрачная цилиндрическая оболочка
            const shellMat = new THREE.MeshStandardMaterial({
                color: new THREE.Color(floor.color || '#8C8C8C'),
                transparent: true, opacity: 0.05,
                side: THREE.DoubleSide, metalness: 0.2, roughness: 0.85,
            });
            const shell = new THREE.Mesh(
                new THREE.CylinderGeometry(radius, radius, height, 64, 1, true), shellMat);
            shell.position.y = baseY + height / 2;
            shell.userData.isShell = true;
            group.add(shell);

            // Кольцо-контур по верху (акцент конструктивизма)
            const ring = new THREE.Mesh(
                new THREE.TorusGeometry(radius, 0.12, 8, 80),
                new THREE.MeshStandardMaterial({ color: COLORS.gray, metalness: 0.4, roughness: 0.5 }));
            ring.rotation.x = Math.PI / 2;
            ring.position.y = baseY + height;
            group.add(ring);

            // Прямоугольная пристройка для этажей 1–3 (лестничная башня)
            addAnnexForFloor(group, floor.number, baseY, height, radius);
        }

        if (isMezzanine(floor.number)) {
            // Антресоли: кликабельные прямоугольные плиты внутри пристройки
            addAnnexZoneMeshes(group, byFloor.get(floor.number) || [], floor.number, baseY);
        } else {
            // Основные этажи: кольцевые секторы на цилиндре
            for (const z of (byFloor.get(floor.number) || [])) {
                addZoneMesh(group, z, baseY, height);
            }
        }
    }

    // Сквозные шахты лифта и лестниц — добавляются после заполнения zoneIndex
    addVerticalShafts();

    // Главный вход на 1-м этаже
    addMainEntrance(floorBaseY(1));

    // Стойка ресепшн на 1-м этаже (~215°, внутри зоны магазина)
    addReceptionDesk(floorBaseY(1));

    setFloorFocus(null);
}

// ---------------------------------------------------------------------------
// Пристройка (annex)
// ---------------------------------------------------------------------------

/**
 * Прямоугольное крыло, крепящееся к +X стороне цилиндра.
 * Существует только на этажах 1-3, с каждым этажом немного меньше.
 * Пристройка входит на 1.5м в цилиндр для плавного стыка.
 */
function addAnnexForFloor(group, floorNumber, baseY, height, buildingRadius) {
    const sizes = {
        1: { depth: 26, width: 14 },
        2: { depth: 24, width: 13 },
        3: { depth: 19, width: 11 },
    };
    const sz = sizes[floorNumber];
    if (!sz) return;

    // Этажи 2 и 3 пристройки размещаются в зазорах между цилиндрами (уровни 1.5 и 2.5)
    if (floorNumber === 2) {
        baseY  = FLOOR_BASE_Y.get(1.5) ?? 4.5;
        height = (FLOOR_BASE_Y.get(2)   ?? 7)  - baseY;
    } else if (floorNumber === 3) {
        baseY  = FLOOR_BASE_Y.get(2.5) ?? 11.5;
        height = (FLOOR_BASE_Y.get(3)   ?? 14) - baseY;
    }

    const { depth, width } = sz;
    const attachX = buildingRadius - 1.5;   // заход внутрь цилиндра на 1.5 м
    const centerX = attachX + depth / 2;

    // Полупрозрачные стены
    const walls = new THREE.Mesh(
        new THREE.BoxGeometry(depth, height, width),
        new THREE.MeshStandardMaterial({
            color: 0xE0E0E0, transparent: true, opacity: 0.10,
            side: THREE.DoubleSide, metalness: 0.1, roughness: 0.9,
        })
    );
    walls.position.set(centerX, baseY + height / 2, 0);
    walls.userData.isShell = true;
    group.add(walls);

    // Пол
    const floorPlate = new THREE.Mesh(
        new THREE.PlaneGeometry(depth, width),
        new THREE.MeshStandardMaterial({ color: 0xF5F5F5, roughness: 0.95, metalness: 0 })
    );
    floorPlate.rotation.x = -Math.PI / 2;
    floorPlate.position.set(centerX, baseY + 0.01, 0);
    group.add(floorPlate);

    // Рёбра — конструктивистский акцент
    const edgeLines = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(depth, height, width)),
        new THREE.LineBasicMaterial({ color: 0xAAAAAA, transparent: true, opacity: 0.55 })
    );
    edgeLines.position.set(centerX, baseY + height / 2, 0);
    group.add(edgeLines);
}

// ---------------------------------------------------------------------------
// Зоны пристройки (прямоугольные плиты, кликабельные)
// ---------------------------------------------------------------------------

const CYLINDER_R = 20; // радиус основного цилиндра (постоянный)

// Размеры прямоугольного крыла на каждом уровне антресоли
const ANNEX_SIZES = new Map([
    [1.5, { depth: 24, width: 13 }],
    [2.5, { depth: 19, width: 11 }],
]);

/**
 * Создаёт кликабельные прямоугольные плиты для зон антресольного уровня.
 * Плиты делят пол пристройки на полосы пропорционально угловому диапазону зоны.
 * STAIRS и ELEVATOR пропускаются (у них уже есть маркеры на основных этажах).
 */
function addAnnexZoneMeshes(group, zones, floorNumber, baseY) {
    const sz = ANNEX_SIZES.get(floorNumber);
    if (!sz) return;

    const rooms = zones.filter((z) => z.type !== 'STAIRS' && z.type !== 'ELEVATOR');
    if (!rooms.length) return;

    rooms.sort((a, b) => a.angleStart - b.angleStart);

    const { depth, width } = sz;
    const attachX = CYLINDER_R - 1.5;  // 18.5 — точка стыка с цилиндром
    const centerX = attachX + depth / 2;

    const totalSpan = rooms.reduce((sum, z) => sum + (z.angleEnd - z.angleStart), 0);
    let zOffset = -width / 2;

    for (const z of rooms) {
        const span = z.angleEnd - z.angleStart;
        const zoneWidth = (span / totalSpan) * width;
        const zoneCenterZ = zOffset + zoneWidth / 2;

        const geo = new THREE.PlaneGeometry(depth - 0.3, zoneWidth - 0.12);
        const baseColor = new THREE.Color(z.color || '#8C8C8C');
        const mat = new THREE.MeshStandardMaterial({
            color: baseColor,
            transparent: true, opacity: 0.85,
            side: THREE.DoubleSide, metalness: 0.1, roughness: 0.7,
            emissive: new THREE.Color(0x000000),
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(centerX, baseY + 0.15, zoneCenterZ);
        mesh.userData = { zoneId: z.id, type: z.type, name: z.name, floorNumber: z.floorNumber };
        group.add(mesh);
        zoneMeshes.push(mesh);

        const center = new THREE.Vector3(centerX, baseY + 0.6, zoneCenterZ);
        zoneIndex.set(z.id, { data: z, mesh, center, baseColor, floorNumber: z.floorNumber });

        zOffset += zoneWidth;
    }
}

// ---------------------------------------------------------------------------
// Зоны
// ---------------------------------------------------------------------------

function addZoneMesh(group, z, baseY, floorHeight) {
    const inner = Math.max(0.01, z.radiusInner);
    const outer = z.radiusOuter;
    const thetaStart = deg2rad(z.angleStart);
    const thetaLength = deg2rad(z.angleEnd - z.angleStart);
    const segs = Math.max(6, Math.round((z.angleEnd - z.angleStart) / 4));

    const geo = new THREE.RingGeometry(inner, outer, segs, 1, thetaStart, thetaLength);
    const baseColor = new THREE.Color(z.color || '#8C8C8C');
    const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, metalness: 0.1, roughness: 0.7,
        emissive: new THREE.Color(0x000000),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = baseY + 0.15;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData = { zoneId: z.id, type: z.type, name: z.name, floorNumber: z.floorNumber };
    group.add(mesh);
    zoneMeshes.push(mesh);

    // Центр зоны в мире (для маршрута и камеры): (r cosθ, y, -r sinθ)
    const ang = deg2rad((z.angleStart + z.angleEnd) / 2);
    const rc = (inner + outer) / 2;
    const center = new THREE.Vector3(rc * Math.cos(ang), baseY + 0.6, -rc * Math.sin(ang));

    // Маркер лифта — гладкий синий столбик на каждом этаже
    if (z.type === 'ELEVATOR') {
        const pw = 1.8;
        const ph = floorHeight - 0.3;
        const pillar = new THREE.Mesh(
            new THREE.BoxGeometry(pw, ph, pw),
            new THREE.MeshStandardMaterial({ color: 0x3A7BAD, metalness: 0.7, roughness: 0.3 })
        );
        pillar.position.set(center.x, baseY + ph / 2, center.z);
        pillar.castShadow = true;
        group.add(pillar);
    }

    // Маркер лестницы — янтарные ступенчатые блоки на каждом этаже
    if (z.type === 'STAIRS') {
        const AMBER = 0xC8941A;
        const stairMat = new THREE.MeshStandardMaterial({ color: AMBER, metalness: 0.45, roughness: 0.45 });
        const ph = floorHeight - 0.3;
        const N = 4;
        const stepH = ph / N;

        // Радиальный единичный вектор от центра здания к центру зоны
        const rLen = Math.sqrt(center.x ** 2 + center.z ** 2) || 1;
        const rx = center.x / rLen;
        const rz = center.z / rLen;

        for (let i = 0; i < N; i++) {
            // Каждая ступень смещается радиально — при виде сбоку виден профиль лестницы
            const radialOffset = (i / (N - 1) - 0.5) * 1.0;
            const step = new THREE.Mesh(
                new THREE.BoxGeometry(1.6, stepH * 0.88, 0.65),
                stairMat
            );
            step.position.set(
                center.x + rx * radialOffset,
                baseY + stepH * i + stepH / 2,
                center.z + rz * radialOffset
            );
            step.castShadow = true;
            group.add(step);
        }
    }

    zoneIndex.set(z.id, { data: z, mesh, center, baseColor, floorNumber: z.floorNumber });
}

// ---------------------------------------------------------------------------
// Вертикальные шахты (лифт + лестница) — сквозь все этажи
// ---------------------------------------------------------------------------

/**
 * После построения всех этажей добавляем сквозной маркер лифта:
 * синяя колонна сквозь все этажи.
 * Шахта добавляется прямо в building (вне floor-групп), чтобы
 * оставаться видимой при любом фокусе этажа.
 */
function addVerticalShafts() {
    let elevPos = null;
    const stairsPosList = [];

    // Берём позиции с 1-го этажа как эталонные
    for (const [, entry] of zoneIndex) {
        if (entry.floorNumber !== 1) continue;
        if (entry.data.type === 'ELEVATOR' && !elevPos) elevPos = entry.center;
        if (entry.data.type === 'STAIRS') stairsPosList.push(entry.center);
    }

    const topMeta = floorMeta.get(maxFloor);
    const totalH  = topMeta ? topMeta.baseY + topMeta.height : 25;

    // Шахта лифта — синяя прозрачная колонна
    if (elevPos) {
        const shaftMat = new THREE.MeshStandardMaterial({
            color: 0x3A7BAD, transparent: true, opacity: 0.30,
            metalness: 0.65, roughness: 0.25,
        });
        const geo = new THREE.BoxGeometry(2.0, totalH, 2.0);
        const shaft = new THREE.Mesh(geo, shaftMat);
        shaft.position.set(elevPos.x, totalH / 2, elevPos.z);
        building.add(shaft);

        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: 0x4A9ED6 })
        );
        edges.position.copy(shaft.position);
        building.add(edges);
    }

    // Шахта каждой лестницы — янтарная прозрачная колонна
    for (const stairsPos of stairsPosList) {
        const stairShaftMat = new THREE.MeshStandardMaterial({
            color: 0xC8941A, transparent: true, opacity: 0.22,
            metalness: 0.5, roughness: 0.4,
        });
        const stairGeo = new THREE.BoxGeometry(1.8, totalH, 1.8);
        const stairShaft = new THREE.Mesh(stairGeo, stairShaftMat);
        stairShaft.position.set(stairsPos.x, totalH / 2, stairsPos.z);
        building.add(stairShaft);

        const stairEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(stairGeo),
            new THREE.LineBasicMaterial({ color: 0xE8B422 })
        );
        stairEdges.position.copy(stairShaft.position);
        building.add(stairEdges);
    }
}

// ---------------------------------------------------------------------------
// Главный вход (вестибюль, ступени, козырёк)
// ---------------------------------------------------------------------------

/**
 * Вход привязан к зоне ENTRANCE (300-360°, центр 330°) на 1-м этаже.
 * По планам здания: небольшой вестибюль, выступающий за периметр цилиндра,
 * ступени к улице, металлический козырёк с красной конструктивистской полосой.
 */
function addMainEntrance(baseY) {
    const ang = deg2rad(330);   // середина зоны ENTRANCE (300-360°)
    const R = 20;               // внешний радиус здания

    // Единичный вектор наружу от центра в направлении входа
    const ox = Math.cos(ang);   //  ≈  0.866
    const oz = -Math.sin(ang);  //  ≈  0.5
    // Касательный вектор (вдоль стены, перпендикулярно наружному)
    const tx = oz;              //  ≈  0.5
    const tz = -ox;             //  ≈ -0.866
    // Поворот объектов «лицом» наружу
    const rotY = Math.atan2(ox, oz);

    const concreteMat = new THREE.MeshStandardMaterial({
        color: 0xCCCCCC, roughness: 0.88, metalness: 0,
    });
    const frameMat = new THREE.MeshStandardMaterial({
        color: 0x1A1A1A, roughness: 0.5, metalness: 0.55,
    });
    const accentMat = new THREE.MeshStandardMaterial({
        color: 0xFF0068, roughness: 0.4, metalness: 0.2,
    });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0xB8CCE0, transparent: true, opacity: 0.22,
        roughness: 0.05, metalness: 0.85, side: THREE.DoubleSide,
    });

    const VW = 4.2;    // ширина вестибюля
    const VD = 2.6;    // глубина выступа (наружу от стены)
    const VH = 3.0;    // высота вестибюля

    // Функции смещения точки в мировых координатах
    // d — расстояние от центра здания вдоль ox/oz
    // s — смещение вдоль касательной tx/tz
    const pt = (d, s, y) => new THREE.Vector3(
        ox * d + tx * s,
        baseY + y,
        oz * d + tz * s,
    );

    // ---- Левая и правая стены вестибюля ----
    for (const side of [-1, 1]) {
        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(0.18, VH, VD),
            concreteMat,
        );
        wall.position.copy(pt(R + VD / 2, side * VW / 2, VH / 2));
        wall.rotation.y = rotY;
        wall.castShadow = true;
        building.add(wall);
    }

    // ---- Передняя стена с дверным проёмом ----
    const doorW = 1.8, doorH = 2.4;
    const sideW = (VW - doorW) / 2 - 0.04;
    for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(
            new THREE.BoxGeometry(sideW, VH, 0.18),
            concreteMat,
        );
        panel.position.copy(pt(R + VD, side * (doorW / 2 + sideW / 2), VH / 2));
        panel.rotation.y = rotY;
        panel.castShadow = true;
        building.add(panel);
    }
    // Перемычка над проёмом
    const transom = new THREE.Mesh(
        new THREE.BoxGeometry(doorW, VH - doorH, 0.18),
        concreteMat,
    );
    transom.position.copy(pt(R + VD, 0, doorH + (VH - doorH) / 2));
    transom.rotation.y = rotY;
    building.add(transom);

    // Стеклянная дверь
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(doorW - 0.14, doorH - 0.06, 0.06),
        glassMat,
    );
    door.position.copy(pt(R + VD, 0, doorH / 2));
    door.rotation.y = rotY;
    building.add(door);

    // ---- Потолок вестибюля (тонкая плита) ----
    const ceiling = new THREE.Mesh(
        new THREE.BoxGeometry(VW, 0.12, VD),
        concreteMat,
    );
    ceiling.position.copy(pt(R + VD / 2, 0, VH));
    ceiling.rotation.y = rotY;
    building.add(ceiling);

    // ---- Ступени (3 шт., спускаются наружу) ----
    const STEP_D = 0.44, STEP_H = 0.14;
    for (let i = 0; i < 3; i++) {
        const w = VW + 0.5 - i * 0.28;
        const d = R + VD + STEP_D * (i + 0.5);
        const step = new THREE.Mesh(
            new THREE.BoxGeometry(w, STEP_H, STEP_D),
            concreteMat,
        );
        step.position.copy(pt(d, 0, -(i + 1) * STEP_H + STEP_H / 2));
        step.rotation.y = rotY;
        step.castShadow = true;
        building.add(step);
    }

    // ---- Козырёк (металл) ----
    const canopyD = VD + 2.0;
    const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(VW + 1.0, 0.13, canopyD),
        frameMat,
    );
    canopy.position.copy(pt(R + canopyD / 2, 0, VH + 0.07));
    canopy.rotation.y = rotY;
    canopy.castShadow = true;
    building.add(canopy);

    // Нижние рёбра козырька (конструктивный акцент — тонкие профили)
    for (const side of [-1, 1]) {
        const rib = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.22, canopyD),
            frameMat,
        );
        rib.position.copy(pt(R + canopyD / 2, side * (VW / 2 + 0.36), VH - 0.04));
        rib.rotation.y = rotY;
        building.add(rib);
    }

    // ---- Красная полоса — фирменный конструктивистский акцент ----
    const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(VW + 1.0, 0.12, 0.14),
        accentMat,
    );
    stripe.position.copy(pt(R + canopyD, 0, VH + 0.14));
    stripe.rotation.y = rotY;
    building.add(stripe);

    // ---- Две опорные колонны козырька ----
    for (const side of [-1, 1]) {
        const col = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, VH, 0.16),
            frameMat,
        );
        col.position.copy(pt(R + canopyD - 0.14, side * (VW / 2 + 0.36), VH / 2));
        col.castShadow = true;
        building.add(col);
    }
}

// ---------------------------------------------------------------------------
// Стойка ресепшн (1-й этаж, ~215°, внутри кольцевой галереи)
// ---------------------------------------------------------------------------

function addReceptionDesk(baseY) {
    const ang = deg2rad(215);
    const r   = 11;

    // Радиальный вектор от центра наружу
    const ox = Math.cos(ang);
    const oz = -Math.sin(ang);

    // Центр стойки в мире
    const cx = ox * r;
    const cz = oz * r;

    // Стойка ориентирована по касательной; rotY — чтобы длинная сторона шла вдоль окружности
    const rotY = Math.atan2(ox, oz);

    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xE8E4DC, roughness: 0.75, metalness: 0.05,
    });
    const topMat = new THREE.MeshStandardMaterial({
        color: 0x1A1A1A, roughness: 0.45, metalness: 0.35,
    });
    const accentMat = new THREE.MeshStandardMaterial({
        color: 0xE63329, roughness: 0.4, metalness: 0.15,
    });

    // Основной корпус стойки
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 1.05, 0.75),
        bodyMat,
    );
    body.position.set(cx, baseY + 0.525, cz);
    body.rotation.y = rotY;
    body.castShadow = true;
    building.add(body);

    // Тёмная столешница
    const top = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.07, 0.75),
        topMat,
    );
    top.position.set(cx, baseY + 1.085, cz);
    top.rotation.y = rotY;
    building.add(top);

    // Красная акцентная полоска по фасаду (конструктивизм)
    const faceOffset = 0.76 / 2 + 0.01;
    const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.09, 0.04),
        accentMat,
    );
    stripe.position.set(
        cx - ox * faceOffset,
        baseY + 0.72,
        cz + oz * faceOffset,
    );
    stripe.rotation.y = rotY;
    building.add(stripe);
}

function clear() {
    building.clear();
    floorGroups.clear();
    floorMeta.clear();
    zoneMeshes.length = 0;
    zoneIndex.clear();
    maxFloor = 1;
}

// ---------------------------------------------------------------------------
// Публичный API модуля
// ---------------------------------------------------------------------------

export function getZoneMeshes() { return zoneMeshes; }

export function getZoneData(id) { return zoneIndex.get(id)?.data || null; }

export function zoneCenterWorld(id) {
    const e = zoneIndex.get(id);
    return e ? e.center.clone() : new THREE.Vector3();
}

export function getFloorMeta(number) { return floorMeta.get(number); }

export function getBuildingHeight() {
    const topMeta = floorMeta.get(maxFloor);
    return topMeta ? topMeta.baseY + topMeta.height : 44;
}

export function allZoneData() {
    return [...zoneIndex.values()].map((e) => e.data);
}

/**
 * Фокус на этаже: этажи выше скрываются, выбранный — яркий.
 * null — базовый режим (видны все этажи).
 */
export function setFloorFocus(number) {
    for (const [num, group] of floorGroups) {
        const visible = number == null ? true : num <= number;
        group.visible = visible;
        const focused = number == null || num === number;
        group.traverse((obj) => {
            if (!obj.isMesh) return;
            if (obj.userData.zoneId != null) {
                obj.material.opacity = focused ? 0.92 : 0.18;
            } else if (obj.userData.isShell) {
                obj.material.opacity = focused ? 0.08 : 0.03;
            }
        });
    }
}

/**
 * Подсветить этажи, задействованные в маршруте.
 * floorNumbersSet — Set<number> с номерами «активных» этажей;
 * null — сброс эффекта (все этажи равноправны).
 */
export function setRouteFloors(floorNumbersSet) {
    for (const [num, group] of floorGroups) {
        const active = floorNumbersSet == null || floorNumbersSet.has(num);
        group.traverse((obj) => {
            if (!obj.isMesh) return;
            if (obj.userData.zoneId != null) {
                obj.material.opacity = active ? 0.95 : 0.12;
                if (!active && obj.material.emissive) {
                    obj.material.emissive.setHex(0x000000);
                    obj.material.emissiveIntensity = 0;
                }
            } else if (obj.userData.isShell) {
                obj.material.opacity = active ? 0.10 : 0.02;
            }
        });
    }
}

/**
 * Подсветить набор зон (Set из id). null — снять подсветку.
 */
export function highlightZones(idSet) {
    for (const [id, e] of zoneIndex) {
        const on = idSet && idSet.has(id);
        e.mesh.material.emissive.setHex(on ? 0xFF0068 : 0x000000);
        e.mesh.material.emissiveIntensity = on ? 0.45 : 0;
        e.mesh.material.opacity = idSet ? (on ? 0.98 : 0.4) : 0.9;
    }
}

let pulseZones = [];
/** Мягкая пульсация активных зон (вызывается из цикла рендера). */
export function pulse(dt, time) {
    if (!pulseZones.length) return;
    const k = 0.5 + 0.5 * Math.sin(time * 3);
    for (const id of pulseZones) {
        const e = zoneIndex.get(id);
        if (e) e.mesh.material.emissiveIntensity = 0.3 + 0.5 * k;
    }
}
export function setPulse(ids) {
    for (const id of pulseZones) {
        const e = zoneIndex.get(id);
        if (e) e.mesh.material.emissiveIntensity = 0;
    }
    pulseZones = ids || [];
}
