// Панель живой калибровки блоков пристройки (антресоль 2.5).
import { CALIBRATION, rebuildOverlays } from './building.js';

let _floors = null;
let _zones  = null;

export function initCalibrator(floors, zones) {
    _floors = floors;
    _zones  = zones;
    buildPanel();
}

function rebuild() {
    rebuildOverlays(_floors, _zones);
}

// ---------------------------------------------------------------------------
// Дефолты для «Сброс»
// ---------------------------------------------------------------------------
const DEFAULTS = {
    floor25Blocks: [
        { name: 'Туалет 2.5',    x: 35.0, z:  3.85, w: 13.0, d:  7.5, color: '#3A8C8C' },
        { name: 'Гардероб 2.5',  x: 35.0, z: -3.85, w: 13.0, d:  7.5, color: '#6B5B95' },
        { name: 'Администрация', x: 48.0, z:  0.0,  w: 13.0, d: 15.0, color: '#8C6B3A' },
    ],
};

// ---------------------------------------------------------------------------
// Построение панели
// ---------------------------------------------------------------------------
function buildPanel() {
    const old = document.getElementById('calibrator');
    if (old) old.remove();

    const panel = document.createElement('div');
    panel.id = 'calibrator';
    Object.assign(panel.style, {
        position: 'fixed', top: '70px', right: '12px', zIndex: '9999',
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
    header.innerHTML = '<span>⚙ БЛОКИ ПРИСТРОЙКИ 2.5</span>';

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

    // ── Слайдеры для каждого из 3 блоков 2.5 этажа ──────────────────────────
    for (const blk of CALIBRATION.floor25Blocks) {
        section(body, blk.name.toUpperCase());
        sliderRow(body, 'X',       10, 70, 0.25,
            () => blk.x, v => { blk.x = v; rebuild(); });
        sliderRow(body, 'Y (Z ось)', -15, 15, 0.25,
            () => blk.z, v => { blk.z = v; rebuild(); });
        sliderRow(body, 'Ширина',   0.5, 35, 0.25,
            () => blk.w, v => { blk.w = v; rebuild(); });
        sliderRow(body, 'Длина',    0.5, 20, 0.25,
            () => blk.d, v => { blk.d = v; rebuild(); });
    }

    // ── Кнопки ──────────────────────────────────────────────────────────────
    const btnRow = el('div', { display: 'flex', gap: '6px', marginTop: '10px' });

    const copyBtn = makeBtn('Скопировать', '#FF0068', () => {
        const cfg = CALIBRATION.floor25Blocks.map(b => ({
            name: b.name,
            x: round(b.x), z: round(b.z),
            w: round(b.w), d: round(b.d),
            color: b.color,
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
        CALIBRATION.floor25Blocks.forEach((blk, i) => {
            const d = DEFAULTS.floor25Blocks[i];
            blk.x = d.x; blk.z = d.z; blk.w = d.w; blk.d = d.d;
        });
        rebuild();
        buildPanel();
    });

    btnRow.appendChild(copyBtn);
    btnRow.appendChild(resetBtn);
    body.appendChild(btnRow);

    document.body.appendChild(panel);
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
