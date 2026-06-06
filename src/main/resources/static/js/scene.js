// Инициализация Three.js-сцены: камера, свет, орбитальное управление, цикл рендера.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const COLORS = {
    bg: 0xEFEDE7,     // тёплый светлый фон (как на сайте Центра)
    paper: 0xF6F4EE,
    ink: 0x141414,
    white: 0xFFFFFF,
    red: 0xE63329,
    gray: 0x8C8C8C,
};

export const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);
scene.fog = new THREE.Fog(COLORS.bg, 80, 190);

const container = document.getElementById('sceneContainer');

export const camera = new THREE.PerspectiveCamera(
    50, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(42, 34, 42);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 9, 0);
controls.minDistance = 20;
controls.maxDistance = 120;
controls.maxPolarAngle = Math.PI / 2.05; // не уходим под пол

// Освещение (мягкий дневной свет под светлую тему)
scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(30, 55, 25);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -40;
key.shadow.camera.right = 40;
key.shadow.camera.top = 40;
key.shadow.camera.bottom = -40;
key.shadow.bias = -0.0005;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35);
fill.position.set(-30, 20, -20);
scene.add(fill);

// Площадка-основание (светлая)
const groundMat = new THREE.MeshStandardMaterial({ color: 0xE6E3DB, roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 64), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
ground.receiveShadow = true;
scene.add(ground);

export const raycaster = new THREE.Raycaster();

function onResize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
}
window.addEventListener('resize', onResize);

const animators = [];
/** Зарегистрировать функцию, вызываемую каждый кадр (получает delta-время в секундах). */
export function onFrame(fn) { animators.push(fn); }

const clock = new THREE.Clock();
export function startLoop() {
    function loop() {
        requestAnimationFrame(loop);
        const dt = clock.getDelta();
        controls.update();
        for (const fn of animators) fn(dt);
        renderer.render(scene, camera);
    }
    loop();
}

/** Плавно перевести камеру/таргет к новой цели. */
export function flyTo(targetVec, distance = 48, height = 30) {
    flyTo._to = { target: targetVec.clone(), distance, height, t: 0 };
}
onFrame(() => {
    const s = flyTo._to;
    if (!s) return;
    s.t = Math.min(1, s.t + 0.04);
    const ease = 1 - Math.pow(1 - s.t, 3);
    controls.target.lerp(s.target, 0.08);
    const desired = new THREE.Vector3(s.distance, s.height, s.distance);
    camera.position.lerp(desired.add(new THREE.Vector3(s.target.x, 0, s.target.z)), 0.05 * ease + 0.02);
    if (s.t >= 1) flyTo._to = null;
});
