// 3D-модель Зотова: реальный GLB-shell здания + интерактивные секторы зон + маркер входа.
// Каркас здания грузится из model/zotov-naked.glb; зоны/маршруты/шахты накладываются поверх.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, COLORS, onFrame } from './scene.js';

const deg2rad = (d) => (d * Math.PI) / 180;

const ZONE_PALETTE = ['#FFFFFF', '#D9D9D9', '#B2B2B2', '#838080'];
const HIGHLIGHT_COLOR = 0xFF3399;
function zoneGray(type, idx) { return ZONE_PALETTE[idx % ZONE_PALETTE.length]; }

const ZONE_COLOR_OVERRIDE = new Map([
    [1, '#696868'], // Выставка с коллажем, 1-й этаж
]);

// ---------------------------------------------------------------------------
// Иконки зон — SVG → плоский меш на полу зоны, цвет #696868
// ---------------------------------------------------------------------------
const ICON_TYPE_MAP = {
    EXHIBITION: 'brush',
    SHOP:       'shop',
    ENTRANCE:   'info',
    CAFE:       'cafe',
    WARDROBE:   'cloakroom',
    RESTROOM:   'toilet',
    CINEMA:     'cinema',
    WORKSHOP:   'scissors',
};

// Переопределения по конкретному этажу (floorNumber → zoneType → iconKey)
const ICON_FLOOR_OVERRIDE = new Map([
    [1,   { EXHIBITION: 'collage'     }],  // Коллаж как способ мышления
    [2,   { EXHIBITION: 'kinoglaz'    }],  // Дзига Вертов — Кино-Глаз
    [3,   { EXHIBITION: 'dom21'       }],  // Дом 21
    [4,   { EXHIBITION: 'draftfuture' }],  // Выставка 4-го этажа
]);

function _iconKeyForZone(z) {
    const ov = ICON_FLOOR_OVERRIDE.get(z.floorNumber);
    return (ov && ov[z.type]) || ICON_TYPE_MAP[z.type] || null;
}
const ICON_FLOOR_SIZE = 3.0;       // 4.5 / 1.5 = 3.0
const ICON_FLOOR_Y    = 0.28;      // подъём над поверхностью зоны
const ICON_COLOR      = '#FFFFFF'; // все иконки ярко-белые
const _iconTexCache   = new Map();

async function _loadSvgImage(iconKey) {
    const svgRaw = await fetch(`/icons/${iconKey}.svg`).then(r => r.text());
    const blob = new Blob([svgRaw], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    await new Promise((res) => { img.onload = res; img.onerror = res; img.src = url; });
    URL.revokeObjectURL(url);
    return img;
}

async function _loadIconTexture(iconKey) {
    if (_iconTexCache.has(iconKey)) return _iconTexCache.get(iconKey);
    try {
        const img    = await _loadSvgImage(iconKey);
        const S      = 128;
        const canvas = document.createElement('canvas');
        canvas.width = S; canvas.height = S;
        const ctx    = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, S, S);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = ICON_COLOR;
        ctx.fillRect(0, 0, S, S);
        ctx.globalCompositeOperation = 'source-over';
        const tex = new THREE.CanvasTexture(canvas);
        _iconTexCache.set(iconKey, tex);
        return tex;
    } catch (e) {
        console.warn(`Не удалось загрузить иконку ${iconKey}:`, e);
        return null;
    }
}

function _addIconFloor(parent, x, y, z, iconKey) {
    const mat  = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0.9 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ICON_FLOOR_SIZE, ICON_FLOOR_SIZE), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y + ICON_FLOOR_Y, z);
    mesh.renderOrder = 10;
    parent.add(mesh);
    _loadIconTexture(iconKey).then(tex => { if (tex) { mat.map = tex; mat.needsUpdate = true; } });
}

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

    // Пять блоков пристройки на антресоли 1.5 (откалиброванные координаты)
    floor15Blocks: [
        { zoneId: 9,  name: 'Туалеты (антресоль)',    type: 'RESTROOM',  floorNumber: 1.5, iconKey: 'toilet',        description: 'Санузлы антресольного уровня.',                                      x: 31.25, z: -0.25,   w:  5.25, d: 14.3,  color: '#FFFFFF' },
        { zoneId: 8,  name: 'Гардероб',               type: 'WARDROBE',  floorNumber: 1.5, iconKey: 'cloakroom',     description: 'Бесплатный гардероб. Камеры хранения. Обязателен при посещении выставок.', x: 40.25, z:  3.5,    w: 12.75, d:  6.75, color: '#C8C8C8' },
        { zoneId: 40, name: 'Куллер',                 type: 'PUBLIC',    floorNumber: 1.5, iconKey: 'water',         description: 'Питьевой куллер на антресольном уровне.',                            x: 38.25, z: -3.575,  w:  8.8,  d:  7.15, color: '#E8E8E8' },
        { zoneId: 41, name: 'Детская мастерская А',   type: 'WORKSHOP',  floorNumber: 1.5, iconKey: 'brush',         description: 'Детская мастерская. Занятия для детей по декоративно-прикладному искусству.', x: 50.5,  z:  3.25,   w:  8.0,  d:  7.15, color: '#A8A8A8' },
        { zoneId: 42, name: 'Детская мастерская Б',   type: 'WORKSHOP',  floorNumber: 1.5, iconKey: 'scissors',      description: 'Детская мастерская. Творческие занятия и игровые программы для детей.',        x: 48.5,  z: -3.5,    w: 12.0,  d:  7.15, color: '#D4D4D4' },
    ],

    // Три блока пристройки на антресоли 2.5
    floor25Blocks: [
        { zoneId: 18, name: 'Туалеты (переход 2½)',   type: 'RESTROOM',  floorNumber: 2.5, iconKey: 'toilet',        description: 'Санузел на промежуточной площадке между 2-м и 3-м этажами.',          x: 35.0, z:  3.85, w: 13.0, d:  7.5, color: '#FFFFFF' },
        { zoneId: 43, name: 'Гардероб (переход 2½)',  type: 'WARDROBE',  floorNumber: 2.5, iconKey: 'cloakroom',     description: 'Гардероб на промежуточной площадке.',                                 x: 35.0, z: -3.85, w: 13.0, d:  7.5, color: '#D4D4D4' },
        { zoneId: 44, name: 'Администрация',          type: 'PUBLIC',    floorNumber: 2.5, iconKey: 'administration', description: 'Административные помещения центра.',                                  x: 48.0, z:  0.0,  w: 13.0, d: 15.0, color: '#B0B0B0' },
    ],

    // Два блока пристройки 1-го этажа: кафе (основной блок) + туалет (полоска правого края)
    floor1Blocks: [
        { zoneId: 38, name: 'Зотов.Кафе',        type: 'CAFE',     floorNumber: 1, iconKey: 'cafe',   description: 'Кафе «Зотов» в пристройке первого этажа. Авторское меню, завтраки, обеды и десерты в атмосфере конструктивизма. Работает вт–вс 11:00–22:00, пн — выходной. Бронирование: cafe@centrezotov.ru', x: 39.175, z: 0, w: 22.05, d: 14.95, color: '#D9D9D9' },
        { zoneId: 45, name: 'Туалеты (1 этаж)',   type: 'RESTROOM', floorNumber: 1, iconKey: 'toilet', description: 'Санузлы первого этажа. В пристройке рядом с кафе.',                                                                                                                                               x: 52.825, z: 0,     w:  5.25, d: 14.95, color: '#FFFFFF' },
    ],
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
    [1,   { depth: 24, width: 13 }],
    [1.5, { depth: 24, width: 13 }],
    [2.5, { depth: 19, width: 11 }],
]);

// ---------------------------------------------------------------------------
// Параметры подгонки GLB-модели здания под систему координат зон.
// Модель центрируется по X/Z, ставится основанием на Y=0 и вписывается
// горизонтальным габаритом в диаметр цилиндра (2 * R_OUTER).
// Калибруется визуально — крути эти значения, если каркас не совпал с секторами.
// ---------------------------------------------------------------------------
const MODEL_URL = 'model/zolotov-donedonedone-nakd.glb';
const MODEL_FIT = {
    targetDiameter: R_OUTER * 2, // горизонтальный габарит модели → диаметр застройки
    extraScale: 2.0,             // доп. множитель масштаба
    rotationY: 0,                // доворот вокруг вертикальной оси, радианы
    offset: new THREE.Vector3(14, 0, 0), // сдвиг (X, Y, Z) после центрирования
    opacity: 0.20,               // 20% видимости
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

// Состояние анимации лифта
let _elevCab = null;
let _elevMinY = 0;
let _elevMaxY = 44;
let _elevTime = 0;
onFrame((dt) => {
    if (!_elevCab) return;
    _elevTime += dt;
    const frac = 0.5 - 0.5 * Math.cos((_elevTime % 10) / 10 * Math.PI * 2);
    _elevCab.position.y = _elevMinY + frac * (_elevMaxY - _elevMinY);
});

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
            const mezzZones = byFloor.get(floor.number) || [];
            indexMezzanineCirculationZones(mezzZones, baseY);
            if (floor.number === 1.5) {
                addFloor15Blocks(group, baseY);
            } else if (floor.number === 2.5) {
                addFloor25Blocks(group, baseY);
            } else {
                addAnnexZoneMeshes(group, mezzZones, floor.number, baseY);
            }
        } else {
            const floorZones = byFloor.get(floor.number) || [];
            let colorIdx = 0;
            for (const z of floorZones) {
                if (z.radiusInner >= R_OUTER) continue; // аннекс — отдельно
                if (z.type === 'ELEVATOR' || z.type === 'STAIRS') { indexCirculationZone(z, baseY); continue; }
                addZoneMesh(group, z, baseY, height, colorIdx++);
            }
            if (floor.number === 1) {
                addFloor1Blocks(group, baseY);
            } else if (ANNEX_SIZES.has(floor.number)) {
                const annexZones = floorZones.filter(z => z.radiusInner >= R_OUTER);
                if (annexZones.length) addAnnexZoneMeshes(group, annexZones, floor.number, baseY);
            }
        }
    }

    await loadBuildingModel();
    await loadFacadeModel();
    addVerticalShafts();
    addEntranceMarker();
    applyFacadeClipping();
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
            m.color.setHex(0x0A0A0A);
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
// ФАСАД: внешняя одетая модель (zotov-dressed.glb), поднимается по первому
// скроллу над canvas, полностью скрывая скелет до начала анимации.
// ---------------------------------------------------------------------------
let facadeGroup          = null;
let _facadeClipPlane     = null;
let _facadeRevealStarted = false;
let _facadeRevealDone    = false;
let _facadeSlideY        = 0;
let _facadeProgress      = 0;
let _facadeInitialY      = 0;

export function startFacadeReveal() {
    if (_facadeRevealStarted || _facadeRevealDone || !facadeGroup) return;
    _facadeRevealStarted = true;
}

export function isFacadeRevealDone() { return _facadeRevealDone; }

onFrame((dt) => {
    if (!_facadeRevealStarted || _facadeRevealDone || !facadeGroup) return;

    _facadeProgress = Math.min(1, _facadeProgress + dt * 0.72); // ~1.4 сек

    // Ease-in-out cubic
    const t = _facadeProgress < 0.5
        ? 4 * _facadeProgress ** 3
        : 1 - (-2 * _facadeProgress + 2) ** 3 / 2;

    facadeGroup.position.y = _facadeInitialY + t * _facadeSlideY;

    // Clipping plane следует за нижним краем фасада
    if (_facadeClipPlane) _facadeClipPlane.constant = facadeGroup.position.y;

    if (_facadeProgress >= 1) {
        _facadeRevealDone = true;

        // Снимаем clipping со всех мешей здания
        building.traverse((obj) => {
            if (!obj.isMesh) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => { if (m) m.clippingPlanes = []; });
        });
        _facadeClipPlane = null;

        scene.remove(facadeGroup);
        facadeGroup.traverse((obj) => {
            if (!obj.isMesh) return;
            obj.geometry.dispose();
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach((m) => m.dispose());
        });
        facadeGroup = null;
    }
});

async function loadFacadeModel() {
    if (!buildingModel) { _facadeRevealDone = true; return; }

    // Мировые габариты уже позиционированного скелета — берём как эталон
    const nakedBox    = new THREE.Box3().setFromObject(buildingModel);
    const nakedSize   = nakedBox.getSize(new THREE.Vector3());
    const nakedCenter = nakedBox.getCenter(new THREE.Vector3());

    let gltf;
    try {
        gltf = await new GLTFLoader().loadAsync('model/zotov-dressed.glb');
    } catch (e) {
        console.error('[facade] не удалось загрузить:', e);
        _facadeRevealDone = true;
        return;
    }

    const model    = gltf.scene;
    const rawBox   = new THREE.Box3().setFromObject(model);
    const rawSize  = rawBox.getSize(new THREE.Vector3());
    const rawCenter = rawBox.getCenter(new THREE.Vector3());

    // Центрируем, ставим основание на Y=0
    model.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z);

    // Масштабируем фасад так, чтобы горизонтальный габарит совпал со скелетом
    const horizNaked = Math.max(nakedSize.x, nakedSize.z);
    const horizRaw   = Math.max(rawSize.x, rawSize.z);
    const k = horizRaw > 0 ? horizNaked / horizRaw : 1;

    const pivot = new THREE.Group();
    pivot.add(model);
    pivot.scale.setScalar(k);
    pivot.scale.y = k + 5 / rawSize.y; // высота +5 единиц, ширина не меняется
    // Совмещаем центр фасада с центром скелета, нижний край — там же
    pivot.position.set(nakedCenter.x, nakedBox.min.y, nakedCenter.z);

    const worldBox    = new THREE.Box3().setFromObject(pivot);
    const worldSize   = worldBox.getSize(new THREE.Vector3());
    const worldCenter = worldBox.getCenter(new THREE.Vector3());

    _facadeInitialY = pivot.position.y;
    _facadeSlideY   = worldSize.y + 25; // высота фасада + буфер

    facadeGroup = pivot;
    scene.add(facadeGroup);

    // Clipping plane создаём здесь, применяем позже — после addVerticalShafts/addEntranceMarker
    _facadeClipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), _facadeInitialY);

    console.log('[facade] размеры:', worldSize, 'slideY:', _facadeSlideY);
}

function applyFacadeClipping() {
    if (!_facadeClipPlane) return;
    building.traverse((obj) => {
        if (!obj.isMesh) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => { if (m) m.clippingPlanes = [_facadeClipPlane]; });
    });
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
function addZoneMesh(group, z, baseY, floorHeight, colorIdx = 0) {
    const inner  = Math.max(0.01, z.radiusInner * CALIBRATION.zoneRadiiScale);
    const outer  = z.radiusOuter * CALIBRATION.zoneRadiiScale;
    const thetaStart  = deg2rad(z.angleStart) + Math.PI / 2;
    const thetaLength = deg2rad(z.angleEnd - z.angleStart);
    const segs = Math.max(6, Math.round((z.angleEnd - z.angleStart) / 4));

    const geo       = new THREE.RingGeometry(inner, outer, segs, 1, thetaStart, thetaLength);
    const baseColor = new THREE.Color(ZONE_COLOR_OVERRIDE.get(z.id) ?? zoneGray(z.type, colorIdx));
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
    const worldAng = ang + Math.PI / 2;
    const center = (z.type === 'ENTRANCE' && CALIBRATION.entrancePos)
        ? new THREE.Vector3(CALIBRATION.entrancePos.x, baseY + 0.6, CALIBRATION.entrancePos.z)
        : new THREE.Vector3(rc * Math.cos(worldAng) + CALIBRATION.zoneXOffset, baseY + 0.6, -rc * Math.sin(worldAng));
    zoneIndex.set(z.id, { data: z, mesh, center, baseColor, floorNumber: z.floorNumber });

    const iconKey = _iconKeyForZone(z);
    if (iconKey) {
        // Геометрия кольца смещена на +π/2 относительно data-углов — учитываем при расчёте центра иконки
        const iconAng = (z.type === 'ENTRANCE' && CALIBRATION.entrancePos)
            ? null
            : ang + Math.PI / 2;
        const ix = iconAng !== null ? rc * Math.cos(iconAng) + CALIBRATION.zoneXOffset : center.x;
        const iz = iconAng !== null ? -rc * Math.sin(iconAng) : center.z;
        _addIconFloor(group, ix, baseY, iz, iconKey);
    }
}

// ---------------------------------------------------------------------------
// Лестницы/лифты — индексируются по кольцевой геометрии без меша,
// чтобы маршрутная линия проходила через правильную точку шахты.
// Используется для антресолей, а также для ELEVATOR на основных этажах
// (лифт уже отображён анимированной шахтой через addVerticalShafts).
// ---------------------------------------------------------------------------
function indexCirculationZone(z, baseY) {
    const ang = deg2rad((z.angleStart + z.angleEnd) / 2);
    const rc  = (z.radiusInner + z.radiusOuter) / 2 * CALIBRATION.zoneRadiiScale;
    const center = new THREE.Vector3(
        rc * Math.cos(ang) + CALIBRATION.zoneXOffset,
        baseY + 0.6,
        -rc * Math.sin(ang),
    );
    zoneIndex.set(z.id, {
        data: z, mesh: null, center,
        baseColor: new THREE.Color(zoneGray(z.type)),
        floorNumber: z.floorNumber,
    });
}

function indexMezzanineCirculationZones(zones, baseY) {
    for (const z of zones) {
        if (z.type !== 'STAIRS' && z.type !== 'ELEVATOR') continue;
        indexCirculationZone(z, baseY);
    }
}

// ---------------------------------------------------------------------------
// Общий рендерер для кастомных блоков пристройки — регистрирует меши и zoneIndex.
// ---------------------------------------------------------------------------
function addCustomBlocks(group, blocks, baseY) {
    for (const blk of blocks) {
        const baseColor = new THREE.Color(blk.color);
        const mat = new THREE.MeshStandardMaterial({
            color: baseColor,
            transparent: true, opacity: 0.85,
            side: THREE.DoubleSide, metalness: 0.1, roughness: 0.7,
            emissive: new THREE.Color(0x000000),
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(blk.w, blk.d), mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(blk.x, baseY + 0.15, blk.z);
        mesh.userData = { zoneId: blk.zoneId, type: blk.type, name: blk.name, floorNumber: blk.floorNumber };
        group.add(mesh);
        zoneMeshes.push(mesh);

        const center = new THREE.Vector3(blk.x, baseY + 0.6, blk.z);
        zoneIndex.set(blk.zoneId, {
            data: { id: blk.zoneId, name: blk.name, type: blk.type, floorNumber: blk.floorNumber, description: blk.description },
            mesh, center, baseColor, floorNumber: blk.floorNumber,
        });

        if (blk.iconKey) _addIconFloor(group, blk.x, baseY, blk.z, blk.iconKey);
    }
}

function addFloor1Blocks(group, baseY)  { addCustomBlocks(group, CALIBRATION.floor1Blocks,  baseY); }
function addFloor15Blocks(group, baseY) { addCustomBlocks(group, CALIBRATION.floor15Blocks, baseY); }
function addFloor25Blocks(group, baseY) { addCustomBlocks(group, CALIBRATION.floor25Blocks, baseY); }

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
    const effectiveBaseY = baseY + (cfg.yOffset || 0);

    const totalSpan = rooms.reduce((sum, z) => sum + (z.angleEnd - z.angleStart), 0);
    let zOffset = -width / 2;

    for (const z of rooms) {
        const span        = z.angleEnd - z.angleStart;
        const zoneWidth   = (span / totalSpan) * width;
        const zoneCenterZ = zOffset + zoneWidth / 2;

        const geo       = new THREE.PlaneGeometry(depth - 0.3, zoneWidth - 0.12);
        const baseColor = new THREE.Color(zoneGray(z.type));
        const mat = new THREE.MeshStandardMaterial({
            color: baseColor,
            transparent: true, opacity: 0.85,
            side: THREE.DoubleSide, metalness: 0.1, roughness: 0.7,
            emissive: new THREE.Color(0x000000),
            polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(centerX, effectiveBaseY + 0.15, zoneCenterZ);
        mesh.userData = { zoneId: z.id, type: z.type, name: z.name, floorNumber: z.floorNumber };
        group.add(mesh);
        zoneMeshes.push(mesh);

        const center = new THREE.Vector3(centerX, effectiveBaseY + 0.6, zoneCenterZ);
        zoneIndex.set(z.id, { data: z, mesh, center, baseColor, floorNumber: z.floorNumber });

        const iconKey = _iconKeyForZone(z);
        if (iconKey) _addIconFloor(group, centerX, effectiveBaseY, zoneCenterZ, iconKey);

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
            color: 0x0A0A0A, transparent: true, opacity: 0.28,
            metalness: 0.65, roughness: 0.25,
        });
        const shaftGeo = new THREE.BoxGeometry(2.0, totalH, 2.0);
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        shaft.position.set(elevPos.x, totalH / 2, elevPos.z);
        building.add(shaft);

        const shaftEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(shaftGeo),
            new THREE.LineBasicMaterial({ color: 0x333333 }),
        );
        shaftEdges.position.copy(shaft.position);
        building.add(shaftEdges);

        // Кабина лифта — движется вверх-вниз за 10 секунд
        const cabH = 2.4;
        const cabGeo = new THREE.BoxGeometry(1.5, cabH, 1.5);
        const cabMat = new THREE.MeshStandardMaterial({
            color: 0x4A9ED6, metalness: 0.85, roughness: 0.15,
            transparent: true, opacity: 0.85,
        });
        const cab = new THREE.Mesh(cabGeo, cabMat);
        const cabEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(cabGeo),
            new THREE.LineBasicMaterial({ color: 0xAADFFF }),
        );
        cab.add(cabEdges);
        _elevMinY = cabH / 2 + 0.2;
        _elevMaxY = totalH - cabH / 2 - 0.2;
        cab.position.set(elevPos.x, _elevMinY, elevPos.z);
        building.add(cab);
        _elevCab = cab;
        _elevTime = 0;
    }

    for (const stairsPos of stairsPosList) {
        const shaftMat = new THREE.MeshStandardMaterial({
            color: 0x0A0A0A, transparent: true, opacity: 0.20,
            metalness: 0.5, roughness: 0.4,
        });
        const shaftGeo = new THREE.BoxGeometry(1.8, totalH, 1.8);
        const shaft = new THREE.Mesh(shaftGeo, shaftMat);
        shaft.position.set(stairsPos.x, totalH / 2, stairsPos.z);
        building.add(shaft);

        const shaftEdges = new THREE.LineSegments(
            new THREE.EdgesGeometry(shaftGeo),
            new THREE.LineBasicMaterial({ color: 0x333333 }),
        );
        shaftEdges.position.copy(shaft.position);
        building.add(shaftEdges);

        addStairLadder(stairsPos, totalH);
    }
}

// Лестница-стремянка внутри желтой шахты
function addStairLadder(shaftPos, totalH) {
    const mat = new THREE.MeshStandardMaterial({
        color: 0x1A1A1A, metalness: 0.55, roughness: 0.35,
    });
    const railOffset = 0.55;

    const railGeo = new THREE.CylinderGeometry(0.08, 0.08, totalH, 8);
    for (const dx of [-railOffset, railOffset]) {
        const rail = new THREE.Mesh(railGeo, mat);
        rail.position.set(shaftPos.x + dx, totalH / 2, shaftPos.z);
        building.add(rail);
    }

    const rungSpacing = 0.75;
    const count = Math.floor(totalH / rungSpacing) + 1;
    const rungGeo = new THREE.CylinderGeometry(0.055, 0.055, railOffset * 2, 6);
    const rungs = new THREE.InstancedMesh(rungGeo, mat, count);
    const m = new THREE.Matrix4();
    const rot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
    const scale = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
        m.compose(new THREE.Vector3(shaftPos.x, i * rungSpacing, shaftPos.z), rot, scale);
        rungs.setMatrixAt(i, m);
    }
    rungs.instanceMatrix.needsUpdate = true;
    building.add(rungs);
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
    if (facadeGroup) { scene.remove(facadeGroup); facadeGroup = null; }
    _facadeRevealStarted = false;
    _facadeRevealDone    = false;
    _facadeProgress      = 0;
    building.clear();
    floorGroups.clear();
    floorMeta.clear();
    zoneMeshes.length = 0;
    zoneIndex.clear();
    maxFloor = 1;
    buildingModel = null;
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
            const mezzZones = byFloor.get(floor.number) || [];
            indexMezzanineCirculationZones(mezzZones, baseY);
            if (floor.number === 1.5) {
                addFloor15Blocks(group, baseY);
            } else if (floor.number === 2.5) {
                addFloor25Blocks(group, baseY);
            } else {
                addAnnexZoneMeshes(group, mezzZones, floor.number, baseY);
            }
        } else {
            const floorZones = byFloor.get(floor.number) || [];
            let colorIdx = 0;
            for (const z of floorZones) {
                if (z.radiusInner >= R_OUTER) continue; // аннекс — отдельно
                if (z.type === 'ELEVATOR' || z.type === 'STAIRS') { indexCirculationZone(z, baseY); continue; }
                addZoneMesh(group, z, baseY, height, colorIdx++);
            }
            if (floor.number === 1) {
                addFloor1Blocks(group, baseY);
            } else if (ANNEX_SIZES.has(floor.number)) {
                const annexZones = floorZones.filter(z => z.radiusInner >= R_OUTER);
                if (annexZones.length) addAnnexZoneMeshes(group, annexZones, floor.number, baseY);
            }
        }
    }
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
        if (!e.mesh) continue;
        const on = idSet && idSet.has(id);
        e.mesh.material.color.setHex(on ? HIGHLIGHT_COLOR : e.baseColor.getHex());
        e.mesh.material.emissive.setHex(on ? HIGHLIGHT_COLOR : 0x000000);
        e.mesh.material.emissiveIntensity = on ? 0.6 : 0;
        e.mesh.material.opacity = idSet ? (on ? 0.98 : 0.4) : 0.85;
    }
}

let pulseZones = [];

export function pulse(dt, time) {
    if (!pulseZones.length) return;
    const k = 0.5 + 0.5 * Math.sin(time * 3);
    for (const id of pulseZones) {
        const e = zoneIndex.get(id);
        if (e && e.mesh) e.mesh.material.emissiveIntensity = 0.3 + 0.5 * k;
    }
}

export function setPulse(ids) {
    for (const id of pulseZones) {
        const e = zoneIndex.get(id);
        if (e && e.mesh) e.mesh.material.emissiveIntensity = 0;
    }
    pulseZones = ids || [];
}
