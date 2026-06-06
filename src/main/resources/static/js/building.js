// 3D-модель здания из примитивов: 5 цилиндров-этажей + секторные зоны (RingGeometry).
// ВРЕМЕННО: финальную детализированную модель подставят 3D-моделлеры —
// функции zoneCenterWorld() / getZoneData() / индексы зон останутся теми же.
import * as THREE from 'three';
import { scene, COLORS } from './scene.js';

const VERTICAL_GAP = 2;        // зазор между этажами для читаемости, м
const deg2rad = (d) => (d * Math.PI) / 180;

export const building = new THREE.Group();
building.name = 'building';
scene.add(building);

const floorGroups = new Map();   // number -> THREE.Group
const floorMeta = new Map();     // number -> { baseY, height, radius }
const zoneMeshes = [];           // для Raycaster
const zoneIndex = new Map();     // zoneId -> { data, mesh, center: Vector3, baseColor, floorNumber }

let maxFloor = 1;

/** Мировая координата центра этажа (по номеру) — основание. */
function floorBaseY(number) {
    return (number - 1) * (4 + VERTICAL_GAP);
}

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
        const baseY = floorBaseY(floor.number);
        floorMeta.set(floor.number, { baseY, height, radius });

        const group = new THREE.Group();
        group.userData.floorNumber = floor.number;
        floorGroups.set(floor.number, group);
        building.add(group);

        // Тонкий диск-перекрытие этажа
        const disk = new THREE.Mesh(
            new THREE.CircleGeometry(radius, 64),
            new THREE.MeshStandardMaterial({ color: 0xFBFAF6, roughness: 0.95, metalness: 0 })
        );
        disk.rotation.x = -Math.PI / 2;
        disk.position.y = baseY;
        disk.receiveShadow = true;
        group.add(disk);

        // Полупрозрачная цилиндрическая оболочка этажа
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

        // Кольцо-контур по верху этажа (акцент конструктивизма)
        const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radius, 0.12, 8, 80),
            new THREE.MeshStandardMaterial({ color: COLORS.gray, metalness: 0.4, roughness: 0.5 }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = baseY + height;
        group.add(ring);

        // Зоны-секторы
        for (const z of (byFloor.get(floor.number) || [])) {
            addZoneMesh(group, z, baseY);
        }
    }
    setFloorFocus(null);
}

function addZoneMesh(group, z, baseY) {
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

    // Маркер-«столбик» для зон вертикальной связи, чтобы их было видно
    if (z.type === 'STAIRS' || z.type === 'ELEVATOR') {
        const pillar = new THREE.Mesh(
            new THREE.CylinderGeometry(0.6, 0.6, 3.4, 16),
            new THREE.MeshStandardMaterial({ color: baseColor, metalness: 0.5, roughness: 0.4 }));
        pillar.position.set(center.x, baseY + 1.7, center.z);
        pillar.castShadow = true;
        group.add(pillar);
    }

    zoneIndex.set(z.id, { data: z, mesh, center, baseColor, floorNumber: z.floorNumber });
}

function clear() {
    building.clear();
    floorGroups.clear();
    floorMeta.clear();
    zoneMeshes.length = 0;
    zoneIndex.clear();
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
 * Подсветить набор зон (Set из id). null — снять подсветку (вернуть базовый вид).
 * Невыделенные зоны лишь приглушаются, но остаются видимыми и КЛИКАБЕЛЬНЫМИ.
 */
export function highlightZones(idSet) {
    for (const [id, e] of zoneIndex) {
        const on = idSet && idSet.has(id);
        e.mesh.material.emissive.setHex(on ? 0xE63329 : 0x000000);
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
