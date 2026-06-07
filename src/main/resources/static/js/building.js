// 3D-модель Зотова: реальный GLB-shell здания + интерактивные секторы зон + маркер входа.
// Каркас здания грузится из model/zotov-naked.glb; зоны/маршруты/шахты накладываются поверх.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, COLORS } from './scene.js';

const deg2rad = (d) => (d * Math.PI) / 180;

// ---------------------------------------------------------------------------
// Калибровочные параметры наложений — экспортируются для live-редактора.
// Меняй через calibrator.js, не вручную.
// ---------------------------------------------------------------------------
export const CALIBRATION = {
    zoneRadiiScale: 0.96,
    zoneYScale:     1.05,
    zoneYOffset:    -2.5,
    zoneXOffset:    -3.5,
    floorYExtra: { 1: 3, 1.5: -1.5, 2: 3, 2.5: -6, 3: 1, 4: -1 },

    annexFloors: {
        1:   { xOffset: 9.5, yOffset: 0, scale: 1.15 },
        1.5: { xOffset: 9.5, scale: 1.1 },
        2.5: { xOffset: 9.5, scale: 1.4 },
    },

    entrancePos: { x: 24.17, z: 5.58 },
};

// Y-позиции этажей (исходные, до масштабирования)
const FLOOR_BASE_Y_RAW = new Map([
    [1,   0],
    [1.5, 8],
    [2,   12],
    [2.5, 20],
    [3,   24],
    [4,   34],
]);

// Геометрические константы (data.sql: R_OUTER=20) — система координат для зон/маршрутов
const R_OUTER   = 20;      // радиус основного цилиндра (целевой габарит модели)

// Пристройка (аннекс) — нужна для раскладки антресольных зон и маркера входа
const ANNEX_ATTACH_X = R_OUTER - 1.5;   // = 18.5 — начало пристройки
const ANNEX_SIZES = new Map([
    [1.5, { depth: 24, width: 13 }],
    [2.5, { depth: 19, width: 11 }],
]);

// ---------------------------------------------------------------------------
// Параметры подгонки GLB-модели здания под систему координат зон.
// Модель центрируется по X/Z, ставится основанием на Y=0 и вписывается
// горизонтальным габаритом в диаметр цилиндра (2 * R_OUTER).
// Калибруется визуально — крути эти значения, если каркас не совпал с секторами.
// ---------------------------------------------------------------------------
const MODEL_URL = 'model/zotov-naked.glb';
const MODEL_FIT = {
    targetDiameter: R_OUTER * 2, // горизонтальный габарит модели → диаметр застройки
    extraScale: 2.0,             // доп. множитель масштаба
    rotationY: 0,                // доворот вокруг вертикальной оси, радианы
    offset: new THREE.Vector3(14, 0, 0), // сдвиг (X, Y, Z) после центрирования
    opacity: 0.35,               // полупрозрачность, чтобы видеть зоны/маршруты внутри
    stretchY: 14,                // растяжка по высоте в мировых единицах (не меняет X/Z)
    stretchXZ: 3,                // растяжка по ширине в мировых единицах (не меняет Y)
};

export const building = new THREE.Group();
building.name = 'building';
scene.add(building);

const floorGroups = new Map();
const floorMeta   = new Map();
const zoneMeshes  = [];
const zoneIndex   = new Map();
let maxFloor = 1;

function floorBaseY(number) {
    const raw   = FLOOR_BASE_Y_RAW.get(number) ?? (number - 1) * 7;
    const extra = CALIBRATION.floorYExtra[number] ?? 0;
    return raw * CALIBRATION.zoneYScale + CALIBRATION.zoneYOffset + extra;
}
function isMezzanine(number) { return !Number.isInteger(number); }

// ---------------------------------------------------------------------------
// Главная функция — строит весь 3D-слой
// ---------------------------------------------------------------------------
export async function buildBuilding(floors, zones) {
    clear();

    const byFloor = new Map();
    for (const z of zones) {
        if (!byFloor.has(z.floorNumber)) byFloor.set(z.floorNumber, []);
        byFloor.get(z.floorNumber).push(z);
    }

    for (const floor of floors) {
        maxFloor = Math.max(maxFloor, floor.number);
        const height = floor.heightMeters || 4;
        const radius = floor.radiusMeters || R_OUTER;
        const baseY  = floorBaseY(floor.number);
        floorMeta.set(floor.number, { baseY, height, radius });

        const group = new THREE.Group();
        group.userData.floorNumber = floor.number;
        floorGroups.set(floor.number, group);
        building.add(group);

        if (isMezzanine(floor.number)) {
            addAnnexZoneMeshes(group, byFloor.get(floor.number) || [], floor.number, baseY);
        } else {
            for (const z of (byFloor.get(floor.number) || [])) {
                addZoneMesh(group, z, baseY, height);
            }
        }
    }

    await loadBuildingModel();
    addVerticalShafts();
    addEntranceMarker();
    setFloorFocus(null);
}

// ---------------------------------------------------------------------------
// SHELL: реальный каркас здания из GLB-модели (model/zotov-naked.glb).
// Грузится, центрируется и вписывается в систему координат зон, делается
// полупрозрачным, чтобы сквозь стены были видны секторы и маршруты.
// ---------------------------------------------------------------------------
let buildingModel = null;

async function loadBuildingModel() {
    let gltf;
    try {
        gltf = await new GLTFLoader().loadAsync(MODEL_URL);
    } catch (e) {
        console.error('Не удалось загрузить модель здания:', e);
        return;
    }

    const model = gltf.scene;

    // Габариты модели в её собственных единицах
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    // Центрируем геометрию по X/Z и ставим основанием на Y=0 (в локальных единицах)
    model.position.set(-center.x, -box.min.y, -center.z);

    // Полупрозрачные материалы + тени
    model.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
            if (!m) continue;
            m.transparent = true;
            m.opacity = MODEL_FIT.opacity;
            m.depthWrite = false;
            m.side = THREE.DoubleSide;
        }
    });

    // Pivot: масштаб/поворот/сдвиг применяем к обёртке, чтобы центрирование
    // и опора на Y=0 сохранялись при повороте вокруг вертикали.
    const horizMax = Math.max(size.x, size.z) || 1;
    const scale = (MODEL_FIT.targetDiameter / horizMax) * MODEL_FIT.extraScale;
    const scaleXZ = scale + (MODEL_FIT.stretchXZ || 0) / (horizMax || 1);
    const scaleY = scale + (MODEL_FIT.stretchY || 0) / (size.y || 1);

    const pivot = new THREE.Group();
    pivot.name = 'buildingModel';
    pivot.add(model);
    pivot.scale.set(scaleXZ, scaleY, scaleXZ);
    pivot.rotation.y = MODEL_FIT.rotationY;
    pivot.position.copy(MODEL_FIT.offset);

    buildingModel = pivot;
    building.add(pivot);
}

// ---------------------------------------------------------------------------
// ВХОД: маркер входа по референсу обозначения.jpg
// ↗ ВХОД/EXIT у восточного торца нижней пристройки, 1-й этаж
// ---------------------------------------------------------------------------
function addEntranceMarker() {
    const pos = CALIBRATION.entrancePos;
    if (!pos) return;
    const CLR = 0xFF0068;

    const g = new THREE.Group();
    g.name = 'entranceMarker';
    g.position.set(pos.x, 0, pos.z);
    building.add(g);

    const pinMat = new THREE.MeshStandardMaterial({
        color: CLR, emissive: new THREE.Color(CLR), emissiveIntensity: 0.55,
    });

    // Иголка (стержень булавки)
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.04, 2.5, 10), pinMat);
    needle.position.y = 1.25;
    g.add(needle);

    // Шарик (головка булавки)
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.52, 20, 20), pinMat);
    ball.position.y = 3.3;
    g.add(ball);

    // Надпись «ВХОД / EXIT»
    const canvas = document.createElement('canvas');
    canvas.width  = 320;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FF0068';
    ctx.fillRect(0, 0, 320, 80);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 26px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ВХОД / EXIT', 160, 40);
    const label = new THREE.Mesh(
        new THREE.PlaneGeometry(6.5, 1.6),
        new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(canvas),
            transparent: true, depthWrite: false, side: THREE.DoubleSide,
        }),
    );
    label.position.y = 5.2;
    g.add(label);

    // Светящееся кольцо у основания
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.0, 0.13, 8, 40),
        new THREE.MeshStandardMaterial({ color: CLR, emissive: new THREE.Color(CLR), emissiveIntensity: 0.9 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.1;
    g.add(ring);
}

// ---------------------------------------------------------------------------
// Зоны основных этажей (интерактивный слой — секторные кольца)
// ---------------------------------------------------------------------------
function addZoneMesh(group, z, baseY, floorHeight) {
    const inner  = Math.max(0.01, z.radiusInner * CALIBRATION.zoneRadiiScale);
    const outer  = z.radiusOuter * CALIBRATION.zoneRadiiScale;
    const thetaStart  = deg2rad(z.angleStart);
    const thetaLength = deg2rad(z.angleEnd - z.angleStart);
    const segs = Math.max(6, Math.round((z.angleEnd - z.angleStart) / 4));

    const geo       = new THREE.RingGeometry(inner, outer, segs, 1, thetaStart, thetaLength);
    const baseColor = new THREE.Color(z.color || '#8C8C8C');
    const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, metalness: 0.1, roughness: 0.7,
        emissive: new THREE.Color(0x000000),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x  = -Math.PI / 2;
    mesh.position.set(CALIBRATION.zoneXOffset, baseY + 0.15, 0);
    mesh.receiveShadow = true;
    mesh.userData = { zoneId: z.id, type: z.type, name: z.name, floorNumber: z.floorNumber };
    group.add(mesh);
    zoneMeshes.push(mesh);

    const ang = deg2rad((z.angleStart + z.angleEnd) / 2);
    const rc  = (z.radiusInner + z.radiusOuter) / 2 * CALIBRATION.zoneRadiiScale;
    const center = new THREE.Vector3(rc * Math.cos(ang) + CALIBRATION.zoneXOffset, baseY + 0.6, -rc * Math.sin(ang));
    zoneIndex.set(z.id, { data: z, mesh, center, baseColor, floorNumber: z.floorNumber });
}

// ---------------------------------------------------------------------------
// Зоны пристройки (антресольные уровни)
// ---------------------------------------------------------------------------
const CYLINDER_R = R_OUTER;

function addAnnexZoneMeshes(group, zones, floorNumber, baseY) {
    const sz = ANNEX_SIZES.get(floorNumber);
    if (!sz) return;

    const rooms = zones.filter((z) => z.type !== 'STAIRS' && z.type !== 'ELEVATOR');
    if (!rooms.length) return;

    rooms.sort((a, b) => a.angleStart - b.angleStart);

    const cfg     = CALIBRATION.annexFloors[floorNumber] || { xOffset: 0, scale: 1 };
    const depth   = sz.depth * cfg.scale;
    const width   = sz.width * cfg.scale;
    const attachX = CYLINDER_R - 1.5;
    const centerX = attachX + depth / 2 + cfg.xOffset;

    const totalSpan = rooms.reduce((sum, z) => sum + (z.angleEnd - z.angleStart), 0);
    let zOffset = -width / 2;

    for (const z of rooms) {
        const span        = z.angleEnd - z.angleStart;
        const zoneWidth   = (span / totalSpan) * width;
        const zoneCenterZ = zOffset + zoneWidth / 2;

        const geo       = new THREE.PlaneGeometry(depth - 0.3, zoneWidth - 0.12);
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
// Вертикальные шахты (лифт + лестницы) — навигационный ориентир
// ---------------------------------------------------------------------------
function addVerticalShafts() {
    let elevPos = null;
    const stairsPosList = [];

    for (const [, entry] of zoneIndex) {
        if (entry.floorNumber !== 1) continue;
        if (entry.data.type === 'ELEVATOR' && !elevPos) elevPos = entry.center;
        if (entry.data.type === 'STAIRS') stairsPosList.push(entry.center);
    }

    const topMeta = floorMeta.get(maxFloor);
    const totalH  = topMeta ? topMeta.baseY + topMeta.height : 44;

    if (elevPos) {
        const shaftMat = new THREE.MeshStandardMaterial({
            color: 0x3A7BAD, transparent: true, opacity: 0.28,
            metalness: 0.65, roughness: 0.25,
        });
        const geo   = new THREE.BoxGeometry(2.0, totalH, 2.0);
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

    for (const stairsPos of stairsPosList) {
        const mat = new THREE.MeshStandardMaterial({
            color: 0xC8941A, transparent: true, opacity: 0.20,
            metalness: 0.5, roughness: 0.4,
        });
        const geo   = new THREE.BoxGeometry(1.8, totalH, 1.8);
        const shaft = new THREE.Mesh(geo, mat);
        shaft.position.set(stairsPos.x, totalH / 2, stairsPos.z);
        building.add(shaft);

        const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geo),
            new THREE.LineBasicMaterial({ color: 0xE8B422 })
        );
        edges.position.copy(shaft.position);
        building.add(edges);
    }
}

function clearOverlays() {
    const toRemove = building.children.filter(c => c.name !== 'buildingModel');
    toRemove.forEach(c => building.remove(c));
    floorGroups.clear();
    floorMeta.clear();
    zoneMeshes.length = 0;
    zoneIndex.clear();
    maxFloor = 1;
}

function clear() {
    building.clear();
    floorGroups.clear();
    floorMeta.clear();
    zoneMeshes.length = 0;
    zoneIndex.clear();
    maxFloor = 1;
    buildingModel = null;
}

// Прямоугольный overlay для 1-го этажа пристройки (в БД этаж 1 = кольца, но визуально
// пристройка начинается с уровня 1, поэтому добавляем отдельный прямоугольник).
function addFloor1AnnexRect() {
    const cfg = CALIBRATION.annexFloors[1] || { xOffset: 0, yOffset: 0, scale: 1 };
    const base = ANNEX_SIZES.get(1.5); // используем те же базовые размеры что у 1.5
    const depth   = base.depth * cfg.scale;
    const width   = base.width * cfg.scale;
    const attachX = CYLINDER_R - 1.5;
    const centerX = attachX + depth / 2 + cfg.xOffset;
    const baseY   = floorBaseY(1) + (cfg.yOffset || 0);

    const geo = new THREE.PlaneGeometry(depth - 0.3, width - 0.12);
    const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color('#8a8070'),
        transparent: true, opacity: 0.65,
        side: THREE.DoubleSide, metalness: 0.1, roughness: 0.7,
        emissive: new THREE.Color(0x000000),
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(centerX, baseY + 0.2, 0);
    mesh.userData = { floorNumber: 1, isAnnex1: true };
    building.add(mesh);
}

// Пересборка только зон/шахт/входа без перезагрузки GLB-модели.
// Вызывается из calibrator.js при изменении параметров.
export function rebuildOverlays(floors, zones) {
    clearOverlays();
    const byFloor = new Map();
    for (const z of zones) {
        if (!byFloor.has(z.floorNumber)) byFloor.set(z.floorNumber, []);
        byFloor.get(z.floorNumber).push(z);
    }
    for (const floor of floors) {
        maxFloor = Math.max(maxFloor, floor.number);
        const height = floor.heightMeters || 4;
        const radius = floor.radiusMeters || R_OUTER;
        const baseY  = floorBaseY(floor.number);
        floorMeta.set(floor.number, { baseY, height, radius });
        const group = new THREE.Group();
        group.userData.floorNumber = floor.number;
        floorGroups.set(floor.number, group);
        building.add(group);
        if (isMezzanine(floor.number)) {
            addAnnexZoneMeshes(group, byFloor.get(floor.number) || [], floor.number, baseY);
        } else {
            for (const z of (byFloor.get(floor.number) || [])) {
                addZoneMesh(group, z, baseY, height);
            }
        }
    }
    addFloor1AnnexRect();
    addVerticalShafts();
    addEntranceMarker();
    setFloorFocus(null);
}

export function setEntrancePos(x, z) {
    CALIBRATION.entrancePos = { x, z };
}

// ---------------------------------------------------------------------------
// Публичный API (используется routing.js, ui.js, main.js)
// ---------------------------------------------------------------------------
export function getZoneMeshes()    { return zoneMeshes; }
export function getZoneData(id)    { return zoneIndex.get(id)?.data || null; }
export function getFloorMeta(n)    { return floorMeta.get(n); }
export function allZoneData()      { return [...zoneIndex.values()].map((e) => e.data); }

export function zoneCenterWorld(id) {
    const e = zoneIndex.get(id);
    return e ? e.center.clone() : new THREE.Vector3();
}

export function getBuildingHeight() {
    const topMeta = floorMeta.get(maxFloor);
    return topMeta ? topMeta.baseY + topMeta.height : 44;
}

export function setFloorFocus(number) {
    for (const [num, group] of floorGroups) {
        group.visible = number == null ? true : num <= number;
        const focused = number == null || num === number;
        group.traverse((obj) => {
            if (!obj.isMesh) return;
            if (obj.userData.zoneId != null) {
                obj.material.opacity = focused ? 0.92 : 0.18;
            }
        });
    }
}

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
            }
        });
    }
}

export function highlightZones(idSet) {
    for (const [id, e] of zoneIndex) {
        const on = idSet && idSet.has(id);
        e.mesh.material.emissive.setHex(on ? 0xFF0068 : 0x000000);
        e.mesh.material.emissiveIntensity = on ? 0.45 : 0;
        e.mesh.material.opacity = idSet ? (on ? 0.98 : 0.4) : 0.9;
    }
}

let pulseZones = [];

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
