// Загрузка GLB-моделей здания и анимация reveal (внешний фасад → внутренняя модель).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, camera, controls, onFrame } from './scene.js';

const loader = new GLTFLoader();

export let dressedGroup = null;
export let nakedGroup   = null;

// Параметры анимации
let _revealDone    = false;
let _revealStarted = false;
let _slideY        = 0;     // целевая высота сдвига dressed-модели
let _slideProgress = 0;     // 0..1

export const revealDone = () => _revealDone;

/** Загрузить обе модели. Возвращает Promise, который резолвится когда обе готовы. */
export function loadModels() {
    return Promise.all([
        loadGlb('/models/zotov-dressed.glb'),
        loadGlb('/models/zotov-naked.glb'),
    ]).then(([dressed, naked]) => {
        dressedGroup = dressed;
        nakedGroup   = naked;

        // Определяем bbox naked-модели, чтобы масштаб совпал с зонами.
        // В building.js здание имеет радиус ~20 ед., высота ~38 ед.
        // Масштабируем naked до ширины 40 ед. (диаметр), dressed — тем же k.
        const boxN = new THREE.Box3().setFromObject(nakedGroup);
        const sizeN = boxN.getSize(new THREE.Vector3());
        const maxHoriz = Math.max(sizeN.x, sizeN.z);
        const TARGET_DIAMETER = 40; // совпадает с radius=20 в building.js
        const k = maxHoriz > 0 ? TARGET_DIAMETER / maxHoriz : 1;

        nakedGroup.scale.setScalar(k);
        dressedGroup.scale.setScalar(k);

        // Центрируем naked по горизонтали, нижний край — y=0
        const boxN2 = new THREE.Box3().setFromObject(nakedGroup);
        const centerN = boxN2.getCenter(new THREE.Vector3());
        nakedGroup.position.x -= centerN.x;
        nakedGroup.position.z -= centerN.z;
        nakedGroup.position.y -= boxN2.min.y;

        // dressed — то же смещение
        const boxD = new THREE.Box3().setFromObject(dressedGroup);
        const centerD = boxD.getCenter(new THREE.Vector3());
        dressedGroup.position.x -= centerD.x;
        dressedGroup.position.z -= centerD.z;
        dressedGroup.position.y -= boxD.min.y;

        // Высота сдвига: bbox dressed-модели + запас
        const boxDFinal = new THREE.Box3().setFromObject(dressedGroup);
        _slideY = boxDFinal.getSize(new THREE.Vector3()).y + 30;

        // Делаем корпус naked-модели полупрозрачным (конструктивистская стеклянная эстетика)
        makeTransparent(nakedGroup, 0.18);

        // naked скрыта до начала анимации reveal
        nakedGroup.visible = false;

        scene.add(dressedGroup);
        scene.add(nakedGroup);

        // Камера: откатываемся на 3× диаметра модели, чтобы видеть внешний фасад целиком
        const boxFull = new THREE.Box3().setFromObject(dressedGroup);
        const fullSize = boxFull.getSize(new THREE.Vector3());
        const fullCenter = boxFull.getCenter(new THREE.Vector3());
        const viewDist = Math.max(fullSize.x, fullSize.y, fullSize.z) * 1.8;
        camera.position.set(viewDist * 0.7, fullSize.y * 0.75, viewDist * 0.7);
        controls.target.set(fullCenter.x, fullCenter.y * 0.5, fullCenter.z);
        controls.update();

        console.log('[models] dressed bbox:', fullSize, 'scale k:', k, 'viewDist:', viewDist);
    });
}

/** Начать анимацию reveal (вызывается по первому wheel-событию). */
export function startReveal() {
    if (_revealStarted || _revealDone) return;
    _revealStarted = true;
}

// Анимация в цикле рендера
onFrame((dt) => {
    if (!_revealStarted || _revealDone || !dressedGroup) return;

    // Показываем внутреннюю модель сразу при старте анимации
    if (nakedGroup && !nakedGroup.visible) nakedGroup.visible = true;

    _slideProgress = Math.min(1, _slideProgress + dt * 1.1); // ~0.9 сек

    // Easing: ease-in-out cubic
    const t = _slideProgress < 0.5
        ? 4 * _slideProgress ** 3
        : 1 - (-2 * _slideProgress + 2) ** 3 / 2;

    dressedGroup.position.y = t * _slideY;

    if (_slideProgress >= 1) {
        _revealDone = true;
        dressedGroup.visible = false;
        controls.enableZoom = true;
    }
});

// --------------------------------------------------------------------------

function loadGlb(url) {
    return new Promise((resolve, reject) => {
        loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    });
}

/**
 * Делает все меши группы полупрозрачными, сохраняя оригинальные цвета.
 * Клонирует материалы, чтобы не затронуть dressed-модель.
 */
function makeTransparent(group, opacity) {
    group.traverse((obj) => {
        if (!obj.isMesh) return;
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        const result = mats.map((m) => {
            const c = m.clone();
            c.transparent = true;
            c.opacity = opacity;
            c.side = THREE.DoubleSide;
            c.depthWrite = false;
            c.needsUpdate = true;
            return c;
        });
        obj.material = Array.isArray(obj.material) ? result : result[0];
        obj.renderOrder = 0;
    });
}
