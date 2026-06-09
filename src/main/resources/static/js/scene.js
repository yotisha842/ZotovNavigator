// Инициализация Three.js-сцены: камера, свет, орбитальное управление, цикл рендера.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const COLORS = {
    bg: 0xF0F0F0,
    paper: 0xFFFFFF,
    ink: 0x000000,
    white: 0xFFFFFF,
    red: 0xFF0068,    // фирменная маджента centrezotov.ru
    gray: 0xA5A5A5,
};

export const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.bg);

const container = document.getElementById('sceneContainer');

export const camera = new THREE.PerspectiveCamera(
    50, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(85, 72, 85);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.localClippingEnabled = true;
container.appendChild(renderer.domElement);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 18, 0);
controls.minDistance = 20;
controls.maxDistance = 180;
controls.maxPolarAngle = Math.PI / 2.05;
controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.PAN,
};
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

// Освещение (мягкий дневной свет под светлую тему)
scene.add(new THREE.AmbientLight(0xffffff, 0.95));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(30, 55, 25);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -55;
key.shadow.camera.right = 55;
key.shadow.camera.top = 55;
key.shadow.camera.bottom = -55;
key.shadow.bias = -0.0005;
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35);
fill.position.set(-30, 20, -20);
scene.add(fill);


// Платформа-основание
const groundMat = new THREE.MeshStandardMaterial({ color: 0xD8D8D8, roughness: 1, metalness: 0 });
const ground = new THREE.Mesh(new THREE.CircleGeometry(120, 64), groundMat);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.05;
ground.receiveShadow = true;
scene.add(ground);

export const raycaster = new THREE.Raycaster();

let _panelOffset = 0;

export function setCameraViewOffset(panelWidth) {
    _panelOffset = panelWidth;
    const w = container.clientWidth, h = container.clientHeight;
    if (panelWidth > 0) {
        camera.setViewOffset(w, h, panelWidth / 2, 0, w, h);
    } else {
        camera.clearViewOffset();
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    }
}

function onResize() {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    if (_panelOffset > 0) {
        camera.setViewOffset(w, h, _panelOffset / 2, 0, w, h);
    }
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

/** Плавно перевести камеру/таргет к новой цели.
 *  posOverride — если задан, камера едет именно туда (distance/height игнорируются).
 */
export function flyTo(targetVec, distance = 48, height = 30, posOverride = null) {
    flyTo._to = {
        target: targetVec.clone(),
        distance,
        height,
        pos: posOverride ? posOverride.clone() : null,
        t: 0,
    };
}

/** Мягко подвести камеру к точке БЕЗ поворота модели: сохраняем текущее
 *  направление взгляда (азимут/наклон), лишь чуть приближаемся (factor<1). */
export function zoomToward(targetVec, factor = 0.9) {
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
    const pos = targetVec.clone().add(offset);
    flyTo(targetVec, 0, 0, pos);
}

/** Лёгкий зум без поворота: камера чуть приближается к текущей точке орбиты,
 *  таргет не меняется — никакого вращения/смещения модели. */
export function gentleZoom(factor = 0.85) {
    const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
    flyTo(controls.target.clone(), 0, 0, controls.target.clone().add(offset));
}

/** Вернуть камеру в дефолтное положение (обзор всего здания). */
export function resetCamera() {
    flyTo(new THREE.Vector3(0, 18, 0), 0, 0, new THREE.Vector3(85, 72, 85));
}

onFrame(() => {
    const s = flyTo._to;
    if (!s) return;
    s.t = Math.min(1, s.t + 0.04);
    const ease = 1 - Math.pow(1 - s.t, 3);
    controls.target.lerp(s.target, 0.08);

    let desired;
    if (s.pos) {
        desired = s.pos;
    } else {
        // Радиальное направление: от центра сцены к таргету в горизонтальной плоскости.
        // Если таргет в центре — сохраняем текущий азимут камеры.
        const dir = new THREE.Vector3(s.target.x, 0, s.target.z);
        if (dir.lengthSq() < 0.01) {
            dir.copy(camera.position).setY(0);
            if (dir.lengthSq() < 0.01) dir.set(1, 0, 1);
        }
        dir.normalize();
        desired = new THREE.Vector3(
            s.target.x + dir.x * s.distance,
            s.height,
            s.target.z + dir.z * s.distance,
        );
    }
    camera.position.lerp(desired, 0.05 * ease + 0.02);
    if (s.t >= 1) flyTo._to = null;
});
