// Точка входа: грузим данные, строим здание, включаем интерактив и цикл рендера.
import * as THREE from 'three';
import { api } from './api.js';
import { camera, renderer, raycaster, onFrame, startLoop } from './scene.js';
import { buildBuilding, getZoneMeshes, pulse } from './building.js';
import { initUi, showZone, showTooltip, hideTooltip } from './ui.js';

const pointer = new THREE.Vector2();
let hovered = null;
let startTime = performance.now();

async function boot() {
    const loading = document.getElementById('loading');
    try {
        const floors = await api.floors();
        const zones = await api.zones();
        buildBuilding(floors, zones);
        initUi(floors, zones);
        loading.hidden = true;
    } catch (e) {
        loading.textContent = 'Ошибка загрузки данных: ' + e.message;
        return;
    }

    setupPicking();
    onFrame(() => pulse(0, (performance.now() - startTime) / 1000));
    startLoop();
}

function setupPicking() {
    const canvas = renderer.domElement;

    function updatePointer(event) {
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        return rect;
    }

    function intersectZone() {
        raycaster.setFromCamera(pointer, camera);
        const hits = raycaster.intersectObjects(getZoneMeshes(), false);
        return hits.length ? hits[0].object : null;
    }

    // Hover — tooltip + курсор
    canvas.addEventListener('pointermove', (event) => {
        const rect = updatePointer(event);
        const mesh = intersectZone();
        if (mesh && mesh.visible && mesh.material.opacity > 0.1) {
            hovered = mesh;
            canvas.style.cursor = 'pointer';
            showTooltip(mesh.userData.name, event.clientX - rect.left, event.clientY - rect.top);
        } else {
            hovered = null;
            canvas.style.cursor = 'default';
            hideTooltip();
        }
    });

    // Click — открыть зону (с защитой от перетаскивания орбиты)
    let downPos = null;
    canvas.addEventListener('pointerdown', (e) => { downPos = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', (event) => {
        if (!downPos) return;
        const moved = Math.hypot(event.clientX - downPos.x, event.clientY - downPos.y);
        downPos = null;
        if (moved > 6) return; // это было вращение, не клик
        updatePointer(event);
        const mesh = intersectZone();
        if (mesh && mesh.visible && mesh.material.opacity > 0.1) {
            showZone(mesh.userData.zoneId);
        }
    });
}

boot();
