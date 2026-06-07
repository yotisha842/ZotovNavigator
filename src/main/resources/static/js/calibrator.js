// Панель живой калибровки наложений (зон) поверх GLB-модели.
// Убери импорт из main.js когда закончишь калибровку.
import * as THREE from 'three';
import { camera, renderer, raycaster } from './scene.js';
import { CALIBRATION, rebuildOverlays, setEntrancePos } from './building.js';

let _floors = null;
let _zones  = null;
let _pickingEntrance = false;

export function initCalibrator(floors, zones) {
    _floors = floors;
    _zones  = zones;
    buildPanel();
    setupEntrancePicking();
}

function rebuild() {
    rebuildOverlays(_floors, _zones);
}

// ---------------------------------------------------------------------------
// Дефолты для «Сброс»
// ---------------------------------------------------------------------------
const DEFAULTS = {
    zoneRadiiScale: 0.96,
    zoneYScale:     1.05,
    zoneYOffset:    -2.5,
    zoneXOffset:    -3.5,
    floorYExtra:    { 1: 3, 1.5: -1.5, 2: 3, 2.5: -6, 3: 1, 4: -1 },
    annexFloors: {
        1:   { xOffset: 9.5, yOffset: 0, scale: 1.15 },
        1.5: { xOffset: 9.5, scale: 1.15 },
        2.5: { xOffset: 9.5, scale: 1.15 },
    },
    entrancePos: null,
};

// ---------------------------------------------------------------------------
// Пикинг входа: клик по сцене → записать X/Z на плоскости Y=0
// ---------------------------------------------------------------------------
function setupEntrancePicking() {
    const canvas = renderer.domElement;
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();

    canvas.addEventListener('click', (e) => {
        if (!_pickingEntrance) return;
        e.stopPropagation();

        const rect = canvas.getBoundingClientRect();
        const nx = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
        const ny = -((e.clientY - rect.top)  / rect.height) *  2 + 1;
        raycaster.setFromCamera({ x: nx, y: ny }, camera);
        raycaster.ray.intersectPlane(groundPlane, target);

        setEntrancePos(+target.x.toFixed(2), +target.z.toFixed(2));
        rebuild();

        _pickingEntrance = false;
        canvas.style.cursor = '';
        // обновить текст кнопки — она хранится по id
        const btn = document.getElementById('cal-entrance-btn');
        if (btn) btn.textContent = entranceBtnLabel();
    }, true); // capture — перехватываем раньше main.js
}

function entranceBtnLabel() {
    const p = CALIBRATION.entrancePos;
    return p ? `📍 Переставить вход (${p.x}, ${p.z})` : '📍 Указать вход (клик по сцене)';
}

// ---------------------------------------------------------------------------
// Построение панели
// ---------------------------------------------------------------------------
function buildPanel() {
    const old = document.getElementById('calibrator');
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.id = 'calibrator';
    Object.assign(panel.style, {
        position: 'fixed', top: '70px', left: '12px', zIndex: '9999',
        width: '295px', maxHeight: 'calc(100vh - 90px)',
        overflowY: 'auto', overflowX: 'hidden',
        background: 'rgba(15,15,15,0.93)',
        border: '1px solid #FF0068', borderRadius: '4px',
        fontFamily: 'monospace', fontSize: '11px', color: '#f0f0f0',
        boxShadow: '0 4px 24px rgba(0,0,0,0.7)',
        userSelect: 'none',
    });

    const header = el('div', {
        background: '#FF0068', color: '#fff', fontWeight: 'bold',
        padding: '7px 10px', cursor: 'grab', display: 'flex',
        justifyContent: 'space-between', alignItems: 'center',
        fontSize: '11px', letterSpacing: '0.05em', flexShrink: '0',
    });
    header.innerHTML = '<span>⚙ КАЛИБРАТОР ЗОНЫ</span>';

    const hideBtn = document.createElement('button');
    hideBtn.textContent = '×';
    Object.assign(hideBtn.style, {
        background: 'none', border: 'none', color: '#fff',
        fontSize: '16px', cursor: 'pointer', lineHeight: '1', padding: '0 2px',
    });
    hideBtn.onclick = () => { panel.style.display = 'none'; };
    header.appendChild(hideBtn);
    panel.appendChild(header);
    makeDraggable(panel, header);

    const body = document.createElement('div');
    body.style.padding = '8px 10px';
    panel.appendChild(body);

    // ── Кольца ──────────────────────────────────────────────────────────────
    section(body, 'КОЛЬЦА (ЦЕЛЫЕ ЭТАЖИ)');
    sliderRow(body, 'Радиус колец',   0.3,  1.5, 0.01,
        () => CALIBRATION.zoneRadiiScale, v => { CALIBRATION.zoneRadiiScale = v; rebuild(); });
    sliderRow(body, 'Высота стопки',  0.5,  3.0, 0.05,
        () => CALIBRATION.zoneYScale,     v => { CALIBRATION.zoneYScale = v; rebuild(); });
    sliderRow(body, 'Сдвиг по Y',    -30,   30,  0.5,
        () => CALIBRATION.zoneYOffset,    v => { CALIBRATION.zoneYOffset = v; rebuild(); });
    sliderRow(body, 'Сдвиг по X',    -30,   30,  0.5,
        () => CALIBRATION.zoneXOffset,    v => { CALIBRATION.zoneXOffset = v; rebuild(); });

    // ── Пристройка 1 этаж ───────────────────────────────────────────────────
    section(body, 'ПРИСТРОЙКА — 1 ЭТАЖ');
    annexRows(body, 1, true);

    // ── Пристройка 1.5 этаж ─────────────────────────────────────────────────
    section(body, 'ПРИСТРОЙКА — 1.5 ЭТАЖ');
    annexRows(body, 1.5, false);

    // ── Пристройка 2.5 этаж ─────────────────────────────────────────────────
    section(body, 'ПРИСТРОЙКА — 2.5 ЭТАЖ');
    annexRows(body, 2.5, false);

    // ── Вход ────────────────────────────────────────────────────────────────
    section(body, 'ВХОД');
    const entrBtn = document.createElement('button');
    entrBtn.id = 'cal-entrance-btn';
    entrBtn.textContent = entranceBtnLabel();
    Object.assign(entrBtn.style, {
        width: '100%', padding: '6px', background: '#1a1a1a',
        color: '#FF0068', border: '1px solid #FF0068', borderRadius: '3px',
        cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px',
        marginBottom: '4px', textAlign: 'left',
    });
    entrBtn.onclick = () => {
        _pickingEntrance = true;
        renderer.domElement.style.cursor = 'crosshair';
        entrBtn.textContent = '🎯 Кликни по сцене…';
        entrBtn.style.background = '#FF0068';
        entrBtn.style.color = '#fff';
    };
    body.appendChild(entrBtn);

    // ── Доп. сдвиг этажей ───────────────────────────────────────────────────
    section(body, 'ДОП. СДВИГ Y ЭТАЖЕЙ');
    for (const fl of [1, 1.5, 2, 2.5, 3, 4]) {
        sliderRow(body, `Этаж ${fl}`, -20, 20, 0.5,
            () => CALIBRATION.floorYExtra[fl] ?? 0,
            v  => { CALIBRATION.floorYExtra[fl] = v; rebuild(); });
    }

    // ── Кнопки ──────────────────────────────────────────────────────────────
    const btnRow = el('div', { display: 'flex', gap: '6px', marginTop: '10px' });

    const copyBtn = makeBtn('Скопировать', '#FF0068', () => {
        const cfg = JSON.parse(JSON.stringify({
            zoneRadiiScale: round(CALIBRATION.zoneRadiiScale),
            zoneYScale:     round(CALIBRATION.zoneYScale),
            zoneYOffset:    round(CALIBRATION.zoneYOffset),
            zoneXOffset:    round(CALIBRATION.zoneXOffset),
            floorYExtra:    mapRound(CALIBRATION.floorYExtra),
            annexFloors:    Object.fromEntries(
                Object.entries(CALIBRATION.annexFloors).map(([k, v]) => [k, mapRound(v)])
            ),
            entrancePos: CALIBRATION.entrancePos
                ? { x: round(CALIBRATION.entrancePos.x), z: round(CALIBRATION.entrancePos.z) }
                : null,
        }));
        const text = JSON.stringify(cfg, null, 2);
        navigator.clipboard.writeText(text)
            .then(() => {
                copyBtn.textContent = '✓ Скопировано';
                setTimeout(() => { copyBtn.textContent = 'Скопировать'; }, 1800);
            })
            .catch(() => prompt('Скопируй вручную:', text));
    });

    const resetBtn = makeBtn('Сброс', '#444', () => {
        const d = DEFAULTS;
        CALIBRATION.zoneRadiiScale = d.zoneRadiiScale;
        CALIBRATION.zoneYScale     = d.zoneYScale;
        CALIBRATION.zoneYOffset    = d.zoneYOffset;
        CALIBRATION.zoneXOffset    = d.zoneXOffset;
        CALIBRATION.floorYExtra    = { ...d.floorYExtra };
        CALIBRATION.annexFloors    = {
            1:   { ...d.annexFloors[1] },
            1.5: { ...d.annexFloors[1.5] },
            2.5: { ...d.annexFloors[2.5] },
        };
        CALIBRATION.entrancePos = d.entrancePos;
        rebuild();
        buildPanel();
    });

    btnRow.appendChild(copyBtn);
    btnRow.appendChild(resetBtn);
    body.appendChild(btnRow);

    document.body.appendChild(panel);
}

// ── Строки ползунков для одного этажа пристройки ────────────────────────────
function annexRows(parent, floorNum, hasYOffset) {
    sliderRow(parent, 'Сдвиг по X', -40, 40, 0.5,
        () => CALIBRATION.annexFloors[floorNum].xOffset,
        v  => { CALIBRATION.annexFloors[floorNum].xOffset = v; rebuild(); });
    sliderRow(parent, 'Размер',       0.2, 3.0, 0.05,
        () => CALIBRATION.annexFloors[floorNum].scale,
        v  => { CALIBRATION.annexFloors[floorNum].scale = v; rebuild(); });
    if (hasYOffset) {
        sliderRow(parent, 'Сдвиг по Y', -20, 20, 0.5,
            () => CALIBRATION.annexFloors[floorNum].yOffset || 0,
            v  => { CALIBRATION.annexFloors[floorNum].yOffset = v; rebuild(); });
    }
}

// ---------------------------------------------------------------------------
// Хелперы UI
// ---------------------------------------------------------------------------
function section(parent, label) {
    const d = document.createElement('div');
    Object.assign(d.style, {
        color: '#FF0068', fontWeight: 'bold', marginTop: '12px',
        marginBottom: '4px', letterSpacing: '0.08em', fontSize: '10px',
        borderTop: '1px solid #2a2a2a', paddingTop: '8px',
    });
    d.textContent = label;
    parent.appendChild(d);
}

function sliderRow(parent, label, min, max, step, getter, setter) {
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '5px';

    const lbl = el('div', { display: 'flex', justifyContent: 'space-between', marginBottom: '2px' });
    lbl.innerHTML = `<span style="color:#aaa">${label}</span>`;
    const valSpan = document.createElement('span');
    valSpan.style.color = '#fff';
    valSpan.textContent = (+getter()).toFixed(2);
    lbl.appendChild(valSpan);
    wrap.appendChild(lbl);

    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = min; slider.max = max; slider.step = step;
    slider.value = getter();
    Object.assign(slider.style, { width: '100%', accentColor: '#FF0068', cursor: 'pointer' });
    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        valSpan.textContent = v.toFixed(2);
        setter(v);
    });
    wrap.appendChild(slider);
    parent.appendChild(wrap);
}

function makeBtn(label, bg, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    Object.assign(b.style, {
        flex: '1', padding: '6px 4px', background: bg, color: '#fff',
        border: 'none', borderRadius: '3px', cursor: 'pointer',
        fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold',
    });
    b.addEventListener('click', onClick);
    return b;
}

function el(tag, styles) {
    const d = document.createElement(tag);
    Object.assign(d.style, styles);
    return d;
}

function round(v) { return +parseFloat(v).toFixed(3); }
function mapRound(obj) {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) =>
        [k, typeof v === 'number' ? round(v) : mapRound(v)]
    ));
}

function makeDraggable(elmt, handle) {
    let ox = 0, oy = 0, sx = 0, sy = 0;
    handle.addEventListener('mousedown', e => {
        e.preventDefault();
        handle.style.cursor = 'grabbing';
        sx = e.clientX; sy = e.clientY;
        const r = elmt.getBoundingClientRect();
        ox = r.left; oy = r.top;
        elmt.style.right = 'auto';
        elmt.style.left  = ox + 'px';
        elmt.style.top   = oy + 'px';
        const onMove = e2 => {
            elmt.style.left = (ox + e2.clientX - sx) + 'px';
            elmt.style.top  = (oy + e2.clientY - sy) + 'px';
        };
        const onUp = () => {
            handle.style.cursor = 'grab';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });
}
