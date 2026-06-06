// Отрисовка маршрута в 3D: труба-линия вдоль зон + бегущий маркер + точки старта/финиша.
import * as THREE from 'three';
import { scene, COLORS, onFrame } from './scene.js';
import { zoneCenterWorld } from './building.js';

const group = new THREE.Group();
group.name = 'route';
scene.add(group);

let curve = null;
let tube = null;
let marker = null;
let progress = 0;       // 0..1 — прогресс «прорисовки» линии
let revealDone = false;

export function clearRoute() {
    group.clear();
    curve = null;
    tube = null;
    marker = null;
    progress = 0;
    revealDone = false;
}

/** Построить маршрут по шагам ответа /api/route. */
export function drawRoute(steps) {
    clearRoute();
    if (!steps || steps.length < 2) return;

    const pts = steps.map((s) => {
        const p = zoneCenterWorld(s.zoneId);
        p.y += 0.8;
        return p;
    });

    curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);

    const tubeGeo = new THREE.TubeGeometry(curve, 240, 0.35, 10, false);
    const tubeMat = new THREE.MeshStandardMaterial({
        color: COLORS.red, emissive: COLORS.red, emissiveIntensity: 0.7,
        metalness: 0.3, roughness: 0.4,
    });
    tube = new THREE.Mesh(tubeGeo, tubeMat);
    tube.geometry.setDrawRange(0, 0);
    group.add(tube);

    // Точка старта
    const start = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x2E8B57, emissive: 0x2E8B57, emissiveIntensity: 0.35 }));
    start.position.copy(pts[0]);
    group.add(start);

    // Точка финиша — «пин»
    const end = new THREE.Group();
    const pin = new THREE.Mesh(
        new THREE.ConeGeometry(0.9, 2.4, 18),
        new THREE.MeshStandardMaterial({ color: COLORS.red, emissive: COLORS.red, emissiveIntensity: 0.6 }));
    pin.rotation.x = Math.PI;
    pin.position.y = 1.6;
    end.add(pin);
    const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.MeshStandardMaterial({ color: COLORS.ink }));
    ball.position.y = 2.9;
    end.add(ball);
    end.position.copy(pts[pts.length - 1]);
    group.add(end);

    // Бегущий маркер
    marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 16, 16),
        new THREE.MeshStandardMaterial({ color: COLORS.red, emissive: COLORS.red, emissiveIntensity: 0.9 }));
    marker.position.copy(pts[0]);
    group.add(marker);

    progress = 0;
    revealDone = false;
}

onFrame((dt) => {
    if (!tube || !curve) return;

    // Фаза 1: прорисовка линии
    if (!revealDone) {
        progress = Math.min(1, progress + dt * 0.7);
        const count = tube.geometry.index.count;
        tube.geometry.setDrawRange(0, Math.floor(count * progress));
        if (marker) marker.position.copy(curve.getPointAt(progress));
        if (progress >= 1) { revealDone = true; progress = 0; }
        return;
    }

    // Фаза 2: бесконечный пробег маркера по готовой линии
    progress = (progress + dt * 0.18) % 1;
    if (marker) {
        marker.position.copy(curve.getPointAt(progress));
        const s = 1 + 0.25 * Math.sin(performance.now() * 0.006);
        marker.scale.setScalar(s);
    }
});
