// UI-слой: панели, поиск, афиша, режимы, отображение маршрута. Связывает DOM, API и 3D.
import { api } from './api.js';
import {
    setFloorFocus, highlightZones, getZoneData, allZoneData,
    zoneCenterWorld, getFloorMeta, setPulse,
} from './building.js';
import { drawRoute, clearRoute } from './routing.js';
import { flyTo, setCameraViewOffset } from './scene.js';
import * as THREE from 'three';

const ZONE_LABEL = {
    EXHIBITION: 'Выставка', CINEMA: 'Кинозал', LECTURE: 'Лекторий', WORKSHOP: 'Мастерская',
    SHOP: 'Магазин', CAFE: 'Кафе', PUBLIC: 'Пространство', ENTRANCE: 'Вход',
    RESTROOM: 'Туалеты', WARDROBE: 'Гардероб', ELEVATOR: 'Лифт', STAIRS: 'Лестница',
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
    eventsMenuToggle: document.getElementById('eventsMenuToggle'),
    chatHeaderBtn: document.getElementById('chatHeaderBtn'),
    modeSwitcher: document.getElementById('modeSwitcher'),
    tooltip: document.getElementById('tooltip'),
    transportToggle: document.getElementById('transportToggle'),
};

// Состояние флипа панели
const flip = {
    mode: 'closed',           // 'closed' | 'events' | 'categories'
    activeCategory: null,     // последняя выбранная категория
    openedViaCategory: false, // текущий events-вид открыт через выбор категории
};

const state = {
    floors: [],
    startZoneId: null,        // «Вы здесь»
    defaultStartZoneId: null, // вход по умолчанию — для сброса крестиком
    selectedFloor: null,
    plan: new Set(),          // zoneId для плана дня
    planMode: false,
    preferElevator: false,    // false = лестница (по умолч.), true = лифт
};

// zoneId → Event[] — заполняется при инициализации из main.js
let _eventsCache = new Map();

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"]/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Короткая метка для кнопки переключателя: «1½», «2½» или «1»…«4». */
function fmtFloorBtn(n) {
    if (n === 1.5) return '1½';
    if (n === 2.5) return '2½';
    return String(Math.round(n));
}

/** Читаемая подпись уровня в тексте панели. */
function fmtFloorLabel(n) {
    if (n === 1.5) return 'антресоль (гардероб)';
    if (n === 2.5) return 'переход 2½';
    return `${Math.round(n)}-й этаж`;
}

function fmtDateTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    }).format(d);
}

function fmtTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateRange(startIso, endIso) {
    if (!startIso) return '';
    const s = new Date(startIso);
    const e = endIso ? new Date(endIso) : null;
    const fmt = (d) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(d);
    const diffDays = e ? (e - s) / 86400000 : 0;
    if (diffDays > 1 && e) return `${fmt(s)} — ${fmt(e)}`;
    return new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    }).format(s);
}

// ---------------------------------------------------------------------------
// Инициализация
// ---------------------------------------------------------------------------
export function initUi(floors, zones, eventsMap = new Map()) {
    _eventsCache = eventsMap;
    state.floors = floors;
    const entrance = zones.find((z) => z.type === 'ENTRANCE') || zones[0];
    state.startZoneId = entrance ? entrance.id : null;
    state.defaultStartZoneId = state.startZoneId;

    buildFloorSwitcher(floors);
    wireEvents();

    // Снимаем дефолтный is-active с кнопок режима — режим не выбран на старте
    el.modeSwitcher.querySelectorAll('.mode').forEach((b) => b.classList.remove('is-active'));
    selectFloor(null);

    // По умолчанию открываем «Ближайшие события»
    flip.activeCategory = 'all';
    openAfisha(false, 'all').then(() => { flip.openedViaCategory = true; });
}

function buildFloorSwitcher(floors) {
    el.floorSwitcher.innerHTML = '';

    const iconBtn = document.createElement('button');
    iconBtn.className = 'floors__icon-btn is-active';
    iconBtn.title = 'Все этажи';
    iconBtn.innerHTML = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
    </svg>`;
    iconBtn.onclick = () => selectFloor(null);
    el.floorSwitcher.appendChild(iconBtn);

    const sep = document.createElement('div');
    sep.className = 'floors__sep';
    el.floorSwitcher.appendChild(sep);

    [...floors].sort((a, b) => b.number - a.number).forEach((f) => {
        const b = document.createElement('button');
        b.className = 'floor-btn' + (!Number.isInteger(f.number) ? ' floor-btn--mezzanine' : '');
        b.dataset.floor = f.number;
        b.textContent = fmtFloorBtn(f.number);
        b.title = f.name;
        b.onclick = () => selectFloor(f.number);
        el.floorSwitcher.appendChild(b);
    });
}

function setActiveFloorBtn(number) {
    const iconBtn = el.floorSwitcher.querySelector('.floors__icon-btn');
    if (iconBtn) iconBtn.classList.toggle('is-active', number == null);

    el.floorSwitcher.querySelectorAll('.floor-btn').forEach((b) => {
        b.classList.toggle('is-active', Number(b.dataset.floor) === number);
    });
}

function selectFloor(number) {
    state.selectedFloor = number;
    setFloorFocus(number);
    setActiveFloorBtn(number);
    const meta = number != null ? getFloorMeta(number) : null;
    if (meta) {
        const mezz = !Number.isInteger(number);
        flyTo(new THREE.Vector3(0, meta.baseY + 2, 0), mezz ? 38 : 46, meta.baseY + (mezz ? 18 : 26));
    } else {
        flyTo(new THREE.Vector3(0, 12, 0), 60, 42);
    }
}

function setTransportMode(preferElevator) {
    state.preferElevator = preferElevator;
    el.transportToggle.querySelectorAll('.transport-btn').forEach((b) => {
        const active = b.dataset.transport === (preferElevator ? 'elevator' : 'stairs');
        b.classList.toggle('is-active', active);
    });
}

function wireEvents() {
    el.panelClose.onclick = () => {
        if (flip.mode === 'chat') {
            // Крестик в чате → сбросить маршрут, вернуться к афише
            el.panel.classList.remove('panel--chat');
            el.chatHeaderBtn.classList.remove('is-active');
            clearRoute();
            highlightZones(null);
            setPulse([]);
            flipOut().then(() => openAfisha(false, flip.activeCategory ?? 'all'));
            flip.mode = 'events';
            flip.openedViaCategory = false;
        } else if (flip.mode === 'categories') {
            // Крестик в списке категорий → вернуться к последней категории
            selectCategory(flip.activeCategory ?? 'all');
        } else if (flip.mode === 'events' && flip.openedViaCategory) {
            // Крестик в событиях категории → вернуться к списку категорий
            openEventsMenu();
        } else {
            hidePanel();
        }
    };

    el.eventsMenuToggle.onclick = openEventsMenu;

    el.transportToggle.querySelectorAll('.transport-btn').forEach((btn) => {
        btn.onclick = () => setTransportMode(btn.dataset.transport === 'elevator');
    });

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
// Флип панели
// ---------------------------------------------------------------------------
function flipOut() {
    return new Promise((resolve) => {
        el.panelContent.classList.add('flip-out');
        el.panelContent.addEventListener('animationend', () => {
            el.panelContent.classList.remove('flip-out');
            resolve();
        }, { once: true });
    });
}

function flipIn() {
    el.panelContent.classList.add('flip-in');
    el.panelContent.addEventListener('animationend', () => {
        el.panelContent.classList.remove('flip-in');
    }, { once: true });
}

function renderCategoryList() {
    const items = [
        { key: 'all',        label: 'Ближайшие события' },
        { key: 'EXHIBITION', label: 'Выставки' },
        { key: 'LECTURE',    label: 'Экскурсии' },
        { key: 'OTHER',      label: 'События' },
        { key: 'FILM',       label: 'Кино' },
        { key: 'CONCERT',    label: 'Театр' },
        { key: 'WORKSHOP',   label: 'Детям' },
    ];
    const btns = items.map((it) => `
        <button class="category-item${flip.activeCategory === it.key ? ' is-active' : ''}" data-cat="${it.key}">
            ${escapeHtml(it.label)}
        </button>`).join('');
    el.panelContent.innerHTML = `
        <div class="category-list">
            <div class="category-list__title">Категории</div>
            ${btns}
        </div>`;
    el.panelContent.querySelectorAll('.category-item').forEach((btn) => {
        btn.onclick = () => selectCategory(btn.dataset.cat);
    });
}

function openEventsMenu() {
    if (flip.mode === 'categories') return;
    el.eventsMenuToggle.classList.add('is-active');

    if (flip.mode === 'closed') {
        el.panel.hidden = false;
        setCameraViewOffset(el.panel.offsetWidth);
        renderCategoryList();
        flipIn();
        flip.mode = 'categories';
    } else {
        flip.mode = 'categories';
        flipOut().then(() => { renderCategoryList(); flipIn(); });
    }
}

async function selectCategory(cat) {
    flip.activeCategory = cat;
    el.eventsMenuToggle.classList.remove('is-active');
    await flipOut();
    el.panelContent.innerHTML = `
        <span class="tag">${escapeHtml(CATEGORY_LABEL[cat] || 'Мероприятия')}</span>
        <h2>${escapeHtml(CATEGORY_LABEL[cat] || 'Мероприятия')}</h2>
        <div class="muted">Загрузка…</div>`;
    flip.mode = 'events';
    flipIn();
    await openAfisha(false, cat);
    flip.openedViaCategory = true;
}

// ---------------------------------------------------------------------------
// Панель
// ---------------------------------------------------------------------------
function showPanel(html) {
    el.panelContent.innerHTML = html;
    el.panel.hidden = false;
    setCameraViewOffset(el.panel.offsetWidth);
    flip.mode = 'events';
    flip.openedViaCategory = false; // переопределяется в selectCategory
}

// ---------------------------------------------------------------------------
// Маршрут из чата — рисует в 3D, не трогает чат-панель
// ---------------------------------------------------------------------------
export function getStartZoneId() { return state.startZoneId; }

export async function drawRouteOnly(toZoneId, fromZoneIdOverride = null) {
    const fromZoneId = fromZoneIdOverride ?? state.startZoneId ?? state.defaultStartZoneId ?? 1;
    const resp = await api.route(fromZoneId, toZoneId, state.preferElevator);
    drawRoute(resp.steps);
    setFloorFocus(null);
    setActiveFloorBtn(null);
    state.selectedFloor = null;
    highlightZones(new Set([toZoneId]));
    setPulse([toZoneId]);
    const mid = resp.steps[Math.floor(resp.steps.length / 2)];
    const c = zoneCenterWorld(mid.zoneId);
    flyTo(c, 58, c.y + 24);
    return resp;
}

// Закрытие панели = полный сброс: убираем маршрут и подсветку.
function hidePanel() {
    el.panel.hidden = true;
    el.panel.classList.remove('panel--chat');
    setCameraViewOffset(0);
    clearRoute();
    highlightZones(null);
    setPulse([]);
    flip.mode = 'closed';
    flip.activeCategory = null;
    flip.openedViaCategory = false;
    el.eventsMenuToggle.classList.remove('is-active');
    el.chatHeaderBtn.classList.remove('is-active');
}

// ---------------------------------------------------------------------------
// Чат-панель (вызывается из chat.js)
// ---------------------------------------------------------------------------
export function openChatPanel(renderFn) {
    if (flip.mode === 'chat') return;

    el.eventsMenuToggle.classList.remove('is-active');
    el.chatHeaderBtn.classList.add('is-active');

    const doRender = () => {
        el.panel.classList.add('panel--chat');
        renderFn(el.panelContent);
        flipIn();
        flip.mode = 'chat';
        flip.openedViaCategory = false;
    };

    if (flip.mode === 'closed') {
        el.panel.hidden = false;
        setCameraViewOffset(el.panel.offsetWidth);
        doRender();
    } else {
        flipOut().then(doRender);
    }
}

// ---------------------------------------------------------------------------
// Рекомендации магазина
// ---------------------------------------------------------------------------
const RECO_ZONE_TYPES = new Set(['CINEMA', 'EXHIBITION', 'LECTURE', 'WORKSHOP', 'CAFE', 'SHOP']);

async function appendRecommendations(zoneType) {
    if (!RECO_ZONE_TYPES.has(zoneType)) return;
    let products;
    try { products = await api.recommendations(zoneType); } catch { return; }
    if (!products || !products.length) return;

    const cards = products.map((p) => `
        <a class="shop-card" href="${escapeHtml(p.shopUrl)}" target="_blank" rel="noopener noreferrer">
            <div class="shop-card__name">${escapeHtml(p.name)}</div>
            <div class="shop-card__price">${p.price.toLocaleString('ru-RU')} ₽</div>
        </a>`).join('');

    const section = document.createElement('div');
    section.className = 'shop-section';
    section.innerHTML = `
        <div class="shop-section__title">В магазине Зотова</div>
        ${cards}
        <a class="shop-section__more" href="https://shop.centrezotov.ru/new" target="_blank" rel="noopener noreferrer">Все товары →</a>`;
    el.panelContent.appendChild(section);
}

// ---------------------------------------------------------------------------
// Зона
// ---------------------------------------------------------------------------
export function showZone(zoneId) {
    const z = getZoneData(zoneId);
    if (!z) return;
    highlightZones(new Set([zoneId]));
    setPulse([zoneId]);
    const c = zoneCenterWorld(zoneId);
    flyTo(c, 46, c.y + 22);

    const isStart = state.startZoneId === zoneId;
    const canReset = isStart && state.startZoneId !== state.defaultStartZoneId;

    const zoneEvents = _eventsCache.get(zoneId) || [];
    const now = new Date();

    let mainHtml;

    if (z.type === 'CINEMA') {
        // Кинозал: показываем расписание сеансов на сегодня (start >= now, тот же день)
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
        const todayFilms = zoneEvents.filter((ev) => {
            const s = new Date(ev.startTime);
            return ev.type === 'FILM' && s >= now && s <= todayEnd;
        });
        const upcomingOther = zoneEvents.filter((ev) =>
            ev.type !== 'FILM' && new Date(ev.startTime) >= now
        ).slice(0, 3);

        const filmsHtml = todayFilms.length
            ? todayFilms.map((ev) => `
                <div class="screening-item">
                    <span class="screening-item__time">${fmtTime(ev.startTime)}</span>
                    <span class="screening-item__title">${escapeHtml(ev.title)}</span>
                </div>`).join('')
            : '<div class="screening-empty">Сегодня сеансов больше нет</div>';

        const otherHtml = upcomingOther.length ? `
            <div class="zone-events">
                <div class="zone-events__label">Предстоящие события</div>
                ${upcomingOther.map((ev) => `
                    <div class="zone-event-item">
                        <div class="event-card__type">${escapeHtml(EVENT_LABEL[ev.type] || ev.type)}</div>
                        <div class="event-card__title">${escapeHtml(ev.title)}</div>
                        <div class="event-card__meta">${fmtDateRange(ev.startTime, ev.endTime)}</div>
                    </div>`).join('')}
            </div>` : '';

        mainHtml = `
            <span class="tag">Кинозал</span>
            <h2>${escapeHtml(z.name)}</h2>
            <div class="muted">${fmtFloorLabel(z.floorNumber)}</div>
            <div class="cinema-schedule">
                <div class="cinema-schedule__label">Сегодня</div>
                ${filmsHtml}
            </div>
            ${otherHtml}`;

    } else {
        // Остальные зоны: показываем основное событие
        const primary = zoneEvents[0];
        const extra = zoneEvents.slice(1);

        if (primary) {
            const extraHtml = extra.length ? `
                <div class="zone-events">
                    <div class="zone-events__label">Также здесь</div>
                    ${extra.map((ev) => `
                        <div class="zone-event-item">
                            <div class="event-card__type">${escapeHtml(EVENT_LABEL[ev.type] || ev.type)}</div>
                            <div class="event-card__title">${escapeHtml(ev.title)}</div>
                            <div class="event-card__meta">${fmtDateRange(ev.startTime, ev.endTime)}</div>
                        </div>`).join('')}
                </div>` : '';
            mainHtml = `
                <span class="tag">${escapeHtml(EVENT_LABEL[primary.type] || primary.type)}</span>
                <h2>${escapeHtml(primary.title)}</h2>
                <div class="muted">${fmtFloorLabel(z.floorNumber)} · ${fmtDateRange(primary.startTime, primary.endTime)}</div>
                <p>${escapeHtml(primary.description || '')}</p>
                ${extraHtml}`;
        } else {
            mainHtml = `
                <span class="tag">${escapeHtml(ZONE_LABEL[z.type] || z.type)}</span>
                <h2>${escapeHtml(z.name)}</h2>
                <div class="muted">${fmtFloorLabel(z.floorNumber)}</div>
                <p>${escapeHtml(z.description || '')}</p>`;
        }
    }

    showPanel(`
        ${mainHtml}
        ${isStart ? `<div class="meta-row"><span>Вы здесь</span><b>✓ точка старта</b>${canReset ? '<button class="start-reset-btn" data-act="reset-start" title="Сбросить к входу">×</button>' : ''}</div>` : ''}
        <button class="btn btn--primary" data-act="route" data-id="${z.id}">Маршрут сюда</button>
        ${!isStart ? `<button class="btn btn--block" data-act="here" data-id="${z.id}">Я здесь — стартовать отсюда</button>` : ''}
    `);
    el.panelContent.querySelector('[data-act="route"]').onclick = () => buildRouteTo(zoneId);
    if (canReset) {
        el.panelContent.querySelector('[data-act="reset-start"]').onclick = () => {
            state.startZoneId = state.defaultStartZoneId;
            showZone(zoneId);
        };
    }
    if (!isStart) {
        el.panelContent.querySelector('[data-act="here"]').onclick = () => {
            state.startZoneId = zoneId;
            showZone(zoneId);
        };
    }
    appendRecommendations(z.type);
}

// ---------------------------------------------------------------------------
// Маршрут
// ---------------------------------------------------------------------------
async function buildRouteTo(toZoneId) {
    if (!state.startZoneId) { state.startZoneId = state.defaultStartZoneId || toZoneId; }
    try {
        const resp = await api.route(state.startZoneId, toZoneId, state.preferElevator);
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
    const destZoneId = resp.steps[resp.steps.length - 1].zoneId;
    highlightZones(new Set([destZoneId]));
    setPulse([destZoneId]);

    // Камера на середину маршрута
    const mid = resp.steps[Math.floor(resp.steps.length / 2)];
    const c = zoneCenterWorld(mid.zoneId);
    flyTo(c, 58, c.y + 24);

    const stepsHtml = resp.steps.map((s) => `
        <li class="step">
            <div class="step__text">${escapeHtml(s.instruction)}</div>
            <div class="step__floor">${escapeHtml(ZONE_LABEL[s.zoneType] || '')} · ${fmtFloorLabel(s.floorNumber)}</div>
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
    const destType = resp.steps[resp.steps.length - 1].zoneType;
    appendRecommendations(destType);
}

// ---------------------------------------------------------------------------
// Афиша / план дня
// ---------------------------------------------------------------------------
const CATEGORY_LABEL = {
    all: 'Ближайшие события',
    EXHIBITION: 'Выставки',
    LECTURE: 'Экскурсии',
    OTHER: 'События',
    FILM: 'Кино',
    CONCERT: 'Театр',
    WORKSHOP: 'Детям',
};

async function openAfisha(planMode, categoryFilter = 'all') {
    state.planMode = planMode;
    let events;
    try { events = await api.upcoming(); }
    catch (e) { showPanel(`<h2>Афиша недоступна</h2><p>${escapeHtml(e.message)}</p>`); return; }

    if (categoryFilter && categoryFilter !== 'all') {
        events = events.filter((ev) => ev.type === categoryFilter);
    }

    // Отдельные сеансы (короче 1 дня) — показываем max 1 на кинозал, max 2 суммарно
    const isScreening = (ev) => ev.type === 'FILM' &&
        (new Date(ev.endTime) - new Date(ev.startTime)) < 86400000;
    const screenings = events.filter(isScreening);
    const rest = events.filter((ev) => !isScreening(ev));
    if (screenings.length) {
        const seen = new Set();
        const capped = screenings.filter((ev) => {
            if (seen.has(ev.zoneId) || seen.size >= 2) return false;
            seen.add(ev.zoneId);
            return true;
        });
        events = [...rest, ...capped].sort((a, b) =>
            new Date(a.startTime) - new Date(b.startTime));
    }

    const panelTag = planMode ? 'План дня' : (CATEGORY_LABEL[categoryFilter] || 'Мероприятия');
    const panelTitle = planMode ? 'Соберите свой день' : (CATEGORY_LABEL[categoryFilter] || 'Мероприятия');
    const panelHint = planMode
        ? 'Отметьте события — построим оптимальный маршрут'
        : 'Нажмите на событие, чтобы проложить маршрут';

    if (!events.length) {
        showPanel(`<span class="tag tag--muted">${escapeHtml(panelTag)}</span><h2>${escapeHtml(panelTitle)}</h2><div class="muted">Ближайших событий в этой категории нет</div>`);
        return;
    }

    const cards = events.map((ev) => `
        <div class="event-card" data-id="${ev.id}" data-zone="${ev.zoneId}">
            ${planMode ? `<label class="event-card__check"><input type="checkbox" data-zone="${ev.zoneId}"></label>` : ''}
            <div class="event-card__type">${escapeHtml(EVENT_LABEL[ev.type] || ev.type)}</div>
            <div class="event-card__title">${escapeHtml(ev.title)}</div>
            <div class="event-card__meta">${fmtDateTime(ev.startTime)} · ${escapeHtml(ev.zoneName)} · ${fmtFloorLabel(ev.floorNumber)}</div>
        </div>`).join('');

    showPanel(`
        <span class="tag">${escapeHtml(panelTag)}</span>
        <h2>${escapeHtml(panelTitle)}</h2>
        <div class="muted">${panelHint}</div>
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
        const resp = await api.routeMulti(state.startZoneId, targets, true, state.preferElevator);
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

    // Сценарий «С детьми» — по умолчанию лифт (коляски, маленькие дети).
    // Остальные сценарии — лестница (быстрее для пешеходов, обзор здания).
    setTransportMode(mode === 'kids');

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
        const resp = await api.routeMulti(state.startZoneId, exhibitions, true, state.preferElevator);
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
            <div class="event-card__meta">${fmtDateTime(ev.startTime)} · ${escapeHtml(ev.zoneName)} · ${fmtFloorLabel(ev.floorNumber)}</div>
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
