// UI-слой: панели, поиск, афиша, режимы, отображение маршрута. Связывает DOM, API и 3D.
import { api } from './api.js';
import {
    setFloorFocus, highlightZones, getZoneData, allZoneData,
    zoneCenterWorld, getFloorMeta, setPulse,
} from './building.js';
import { drawRoute, clearRoute } from './routing.js';
import { flyTo } from './scene.js';
import * as THREE from 'three';

const ZONE_LABEL = {
    EXHIBITION: 'Выставка', CINEMA: 'Кинозал', LECTURE: 'Лекторий', SHOP: 'Магазин',
    CAFE: 'Кафе', PUBLIC: 'Пространство', ENTRANCE: 'Вход', RESTROOM: 'Туалеты',
    WARDROBE: 'Гардероб', ELEVATOR: 'Лифт', STAIRS: 'Лестница',
};
const EVENT_LABEL = {
    EXHIBITION: 'Выставка', LECTURE: 'Лекция', FILM: 'Кино',
    CONCERT: 'Концерт', WORKSHOP: 'Мастер-класс', OTHER: 'Событие',
};

const el = {
    panel: document.getElementById('panel'),
    panelContent: document.getElementById('panelContent'),
    panelClose: document.getElementById('panelClose'),
    floorSwitcher: document.getElementById('floorSwitcher'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    afishaToggle: document.getElementById('afishaToggle'),
    helpToggle: document.getElementById('helpToggle'),
    modeSwitcher: document.getElementById('modeSwitcher'),
    tooltip: document.getElementById('tooltip'),
};

const state = {
    floors: [],
    startZoneId: null,        // «Вы здесь»
    selectedFloor: null,
    plan: new Set(),          // zoneId для плана дня
    planMode: false,
};

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"]/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    }).format(d);
}

// ---------------------------------------------------------------------------
// Инициализация
// ---------------------------------------------------------------------------
export function initUi(floors, zones) {
    state.floors = floors;
    const entrance = zones.find((z) => z.type === 'ENTRANCE') || zones[0];
    state.startZoneId = entrance ? entrance.id : null;

    buildFloorSwitcher(floors);
    wireEvents();
    setMode('first');
}

function buildFloorSwitcher(floors) {
    el.floorSwitcher.innerHTML = '';
    const all = document.createElement('button');
    all.className = 'floor-btn floor-btn--all is-active';
    all.textContent = 'Все';
    all.onclick = () => selectFloor(null);
    el.floorSwitcher.appendChild(all);

    [...floors].sort((a, b) => b.number - a.number).forEach((f) => {
        const b = document.createElement('button');
        b.className = 'floor-btn';
        b.dataset.floor = f.number;
        b.textContent = f.number;
        b.title = f.name;
        b.onclick = () => selectFloor(f.number);
        el.floorSwitcher.appendChild(b);
    });
}

function setActiveFloorBtn(number) {
    el.floorSwitcher.querySelectorAll('.floor-btn').forEach((b) => {
        const isAll = b.classList.contains('floor-btn--all');
        const match = isAll ? number == null : Number(b.dataset.floor) === number;
        b.classList.toggle('is-active', match);
    });
}

function selectFloor(number) {
    state.selectedFloor = number;
    setFloorFocus(number);
    setActiveFloorBtn(number);
    const meta = number != null ? getFloorMeta(number) : null;
    if (meta) flyTo(new THREE.Vector3(0, meta.baseY + 2, 0), 46, meta.baseY + 26);
    else flyTo(new THREE.Vector3(0, 9, 0), 52, 34);
}

function wireEvents() {
    el.panelClose.onclick = hidePanel;
    el.afishaToggle.onclick = () => openAfisha(false);
    el.helpToggle.onclick = showHelp;

    el.modeSwitcher.querySelectorAll('.mode').forEach((btn) => {
        btn.onclick = () => {
            el.modeSwitcher.querySelectorAll('.mode').forEach((b) => b.classList.remove('is-active'));
            btn.classList.add('is-active');
            setMode(btn.dataset.mode);
        };
    });

    let timer = null;
    el.searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        const q = el.searchInput.value.trim();
        if (q.length < 2) { el.searchResults.hidden = true; return; }
        timer = setTimeout(() => runSearch(q), 200);
    });
    document.addEventListener('click', (e) => {
        if (!el.searchResults.contains(e.target) && e.target !== el.searchInput) {
            el.searchResults.hidden = true;
        }
    });
}

// ---------------------------------------------------------------------------
// Панель
// ---------------------------------------------------------------------------
function showPanel(html) {
    el.panelContent.innerHTML = html;
    el.panel.hidden = false;
}

// Закрытие панели = полный сброс: убираем маршрут и подсветку.
function hidePanel() {
    el.panel.hidden = true;
    clearRoute();
    highlightZones(null);
    setPulse([]);
}

// ---------------------------------------------------------------------------
// Зона
// ---------------------------------------------------------------------------
export function showZone(zoneId) {
    const z = getZoneData(zoneId);
    if (!z) return;
    // Не прячем другие этажи — иначе остальные зоны нельзя выбрать.
    // Просто подсвечиваем выбранную и подлетаем к ней камерой.
    highlightZones(new Set([zoneId]));
    setPulse([zoneId]);
    const c = zoneCenterWorld(zoneId);
    flyTo(c, 46, c.y + 22);

    const isStart = state.startZoneId === zoneId;
    showPanel(`
        <span class="tag">${escapeHtml(ZONE_LABEL[z.type] || z.type)}</span>
        <h2>${escapeHtml(z.name)}</h2>
        <div class="muted">${z.floorNumber}-й этаж</div>
        <p>${escapeHtml(z.description || '')}</p>
        ${isStart ? '<div class="meta-row"><span>Вы здесь</span><b>✓ точка старта</b></div>' : ''}
        <button class="btn btn--primary" data-act="route" data-id="${z.id}">Маршрут сюда</button>
        <button class="btn btn--block" data-act="here" data-id="${z.id}">Я здесь — стартовать отсюда</button>
    `);
    el.panelContent.querySelector('[data-act="route"]').onclick = () => buildRouteTo(zoneId);
    el.panelContent.querySelector('[data-act="here"]').onclick = () => {
        state.startZoneId = zoneId;
        showZone(zoneId);
    };
}

// ---------------------------------------------------------------------------
// Маршрут
// ---------------------------------------------------------------------------
async function buildRouteTo(toZoneId) {
    if (!state.startZoneId) { state.startZoneId = toZoneId; }
    try {
        const resp = await api.route(state.startZoneId, toZoneId);
        renderRoute(resp);
    } catch (e) {
        showPanel(`<h2>Не удалось построить маршрут</h2><p>${escapeHtml(e.message)}</p>`);
    }
}

function renderRoute(resp) {
    drawRoute(resp.steps);
    setFloorFocus(null);
    setActiveFloorBtn(null);
    state.selectedFloor = null;
    highlightZones(new Set(resp.steps.map((s) => s.zoneId)));

    // Камера на середину маршрута
    const mid = resp.steps[Math.floor(resp.steps.length / 2)];
    const c = zoneCenterWorld(mid.zoneId);
    flyTo(c, 50, c.y + 28);

    const stepsHtml = resp.steps.map((s) => `
        <li class="step">
            <div class="step__text">${escapeHtml(s.instruction)}</div>
            <div class="step__floor">${escapeHtml(ZONE_LABEL[s.zoneType] || '')} · ${s.floorNumber}-й этаж</div>
        </li>`).join('');

    showPanel(`
        <span class="tag">Маршрут</span>
        <h2>${escapeHtml(resp.steps[0].zoneName)} → ${escapeHtml(resp.steps[resp.steps.length - 1].zoneName)}</h2>
        <div class="muted">Следуйте по подсвеченной линии</div>
        <ol class="steps">${stepsHtml}</ol>
        <button class="btn btn--block" data-act="clear">Сбросить маршрут</button>
    `);
    el.panelContent.querySelector('[data-act="clear"]').onclick = () => {
        clearRoute();
        highlightZones(null);
        setPulse([]);
        hidePanel();
    };
}

// ---------------------------------------------------------------------------
// Афиша / план дня
// ---------------------------------------------------------------------------
async function openAfisha(planMode) {
    state.planMode = planMode;
    let events;
    try { events = await api.upcoming(); }
    catch (e) { showPanel(`<h2>Афиша недоступна</h2><p>${escapeHtml(e.message)}</p>`); return; }

    if (!events.length) { showPanel('<span class="tag tag--muted">Афиша</span><h2>Пока нет ближайших событий</h2>'); return; }

    const cards = events.map((ev) => `
        <div class="event-card" data-id="${ev.id}" data-zone="${ev.zoneId}">
            ${planMode ? `<label class="event-card__check"><input type="checkbox" data-zone="${ev.zoneId}"></label>` : ''}
            <div class="event-card__type">${escapeHtml(EVENT_LABEL[ev.type] || ev.type)}</div>
            <div class="event-card__title">${escapeHtml(ev.title)}</div>
            <div class="event-card__meta">${fmtDateTime(ev.startTime)} · ${escapeHtml(ev.zoneName)} · ${ev.floorNumber}-й этаж</div>
        </div>`).join('');

    showPanel(`
        <span class="tag">${planMode ? 'План дня' : 'Афиша'}</span>
        <h2>${planMode ? 'Соберите свой день' : 'Ближайшие события'}</h2>
        <div class="muted">${planMode ? 'Отметьте события — построим оптимальный маршрут' : 'Нажмите на событие, чтобы проложить маршрут'}</div>
        ${cards}
        ${planMode ? '<button class="btn btn--primary" data-act="plan">Построить план дня</button>' : ''}
    `);

    el.panelContent.querySelectorAll('.event-card').forEach((card) => {
        const zoneId = Number(card.dataset.zone);
        if (planMode) {
            const cb = card.querySelector('input');
            cb.onclick = (e) => { e.stopPropagation(); cb.checked ? state.plan.add(zoneId) : state.plan.delete(zoneId); };
            card.onclick = () => { cb.checked = !cb.checked; cb.checked ? state.plan.add(zoneId) : state.plan.delete(zoneId); };
        } else {
            card.onclick = () => buildRouteTo(zoneId);
        }
    });
    if (planMode) {
        el.panelContent.querySelector('[data-act="plan"]').onclick = buildDayPlan;
    }
}

async function buildDayPlan() {
    const targets = [...state.plan];
    if (!targets.length) return;
    try {
        const resp = await api.routeMulti(state.startZoneId, targets, true);
        renderRoute(resp);
    } catch (e) {
        showPanel(`<h2>Не удалось построить план</h2><p>${escapeHtml(e.message)}</p>`);
    }
}

// ---------------------------------------------------------------------------
// Режимы
// ---------------------------------------------------------------------------
function setMode(mode) {
    clearRoute();
    setPulse([]);
    state.plan.clear();

    if (mode === 'first') {
        selectFloor(null);
        const ids = allZoneData()
            .filter((z) => ['ENTRANCE', 'WARDROBE', 'RESTROOM', 'PUBLIC', 'SHOP'].includes(z.type))
            .map((z) => z.id);
        highlightZones(new Set(ids));
        showPanel(`
            <span class="tag">Я впервые</span>
            <h2>Добро пожаловать в Центр «Зотов»</h2>
            <p>Подсвечены ключевые точки: вход, гардероб, касса, книжный магазин и туалеты.
            Нажмите на любую зону, чтобы узнать о ней больше и проложить маршрут.</p>
            <div class="meta-row"><span>Здание</span><b>5 этажей, круглая форма</b></div>
            <div class="meta-row"><span>Старт</span><b>Главный вход, 1 этаж</b></div>
        `);
    } else if (mode === 'event') {
        highlightZones(null);
        openAfisha(false);
    } else if (mode === 'all') {
        buildGrandTour();
    } else if (mode === 'kids') {
        selectFloor(null);
        const ids = allZoneData()
            .filter((z) => ['CAFE', 'RESTROOM'].includes(z.type))
            .map((z) => z.id);
        highlightZones(new Set(ids));
        openKidsAfisha();
    } else if (mode === 'plan') {
        highlightZones(null);
        openAfisha(true);
    }
}

async function buildGrandTour() {
    const exhibitions = allZoneData().filter((z) => z.type === 'EXHIBITION').map((z) => z.id);
    if (!exhibitions.length) return;
    try {
        const resp = await api.routeMulti(state.startZoneId, exhibitions, true);
        renderRoute(resp);
        el.panelContent.insertAdjacentHTML('afterbegin',
            '<div class="muted">Рекомендованный обход всех выставочных залов</div>');
    } catch (e) {
        showPanel(`<h2>Не удалось построить обход</h2><p>${escapeHtml(e.message)}</p>`);
    }
}

async function openKidsAfisha() {
    let events = [];
    try { events = await api.upcoming(); } catch (_) { /* ignore */ }
    const workshops = events.filter((e) => e.type === 'WORKSHOP');
    const cards = workshops.map((ev) => `
        <div class="event-card" data-zone="${ev.zoneId}">
            <div class="event-card__type">${EVENT_LABEL[ev.type]}</div>
            <div class="event-card__title">${escapeHtml(ev.title)}</div>
            <div class="event-card__meta">${fmtDateTime(ev.startTime)} · ${escapeHtml(ev.zoneName)} · ${ev.floorNumber}-й этаж</div>
        </div>`).join('');
    showPanel(`
        <span class="tag">С детьми</span>
        <h2>Мастер-классы и удобства</h2>
        <p>Подсвечены кафе и туалеты. Ниже — ближайшие детские мастер-классы.</p>
        ${cards || '<div class="muted">Ближайших мастер-классов нет</div>'}
    `);
    el.panelContent.querySelectorAll('.event-card').forEach((card) => {
        card.onclick = () => buildRouteTo(Number(card.dataset.zone));
    });
}

function showHelp() {
    showPanel(`
        <span class="tag tag--muted">Подсказка</span>
        <h2>Как пользоваться</h2>
        <p><b>Вращайте</b> здание мышью, колесо — зум. Кликните по любой зоне, чтобы открыть описание и построить маршрут.</p>
        <p>Слева — <b>переключатель этажей</b>. Сверху — <b>поиск</b> по зонам и событиям. Кнопка <b>«Афиша»</b> — ближайшие события.</p>
        <p>Внизу — <b>режимы</b> под разные задачи: «Я впервые», «На мероприятие», «Всё посмотреть», «С детьми», «План дня».</p>
    `);
}

// ---------------------------------------------------------------------------
// Поиск
// ---------------------------------------------------------------------------
async function runSearch(q) {
    let data;
    try { data = await api.search(q); } catch (_) { return; }
    const parts = [];
    if (data.zones.length) {
        parts.push('<div class="search__group-title">Места</div>');
        for (const z of data.zones) {
            parts.push(`<div class="search__item" data-kind="zone" data-id="${z.id}">
                <span>${escapeHtml(z.name)}</span><small>${ZONE_LABEL[z.type] || ''} · ${z.floorNumber} эт.</small></div>`);
        }
    }
    if (data.events.length) {
        parts.push('<div class="search__group-title">События</div>');
        for (const ev of data.events) {
            parts.push(`<div class="search__item" data-kind="event" data-zone="${ev.zoneId}">
                <span>${escapeHtml(ev.title)}</span><small>${EVENT_LABEL[ev.type] || ''}</small></div>`);
        }
    }
    if (!parts.length) parts.push('<div class="search__item"><span>Ничего не найдено</span></div>');

    el.searchResults.innerHTML = parts.join('');
    el.searchResults.hidden = false;
    el.searchResults.querySelectorAll('.search__item').forEach((item) => {
        item.onclick = () => {
            el.searchResults.hidden = true;
            el.searchInput.value = '';
            if (item.dataset.kind === 'zone') showZone(Number(item.dataset.id));
            else if (item.dataset.kind === 'event') buildRouteTo(Number(item.dataset.zone));
        };
    });
}

// Tooltip для hover из main.js
export function showTooltip(name, x, y) {
    el.tooltip.textContent = name;
    el.tooltip.style.left = x + 'px';
    el.tooltip.style.top = y + 'px';
    el.tooltip.hidden = false;
}
export function hideTooltip() { el.tooltip.hidden = true; }
