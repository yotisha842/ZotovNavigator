// ИИ-ассистент GigaChat — рендерится внутри правой панели.
// При navIntent строит маршрут в 3D, не закрывая чат.
import { openChatPanel, drawRouteOnly, getStartZoneId } from './ui.js';

const FAQ = [
    'Где кафе?',
    'Где лекторий?',
    'Как пройти в кинотеатр?',
    'Где гардероб и касса?',
    'Что сейчас проходит?',
    'Как попасть на 4 этаж?',
];

// Persist history and FAQ state across panel open/close cycles
const stored = [];   // {role, content}[] — отображаемые сообщения
let faqDone = false;

// Ожидающий незавершённый маршрут: знаем куда, не знаем откуда
let pendingToId = null;

export function initChat() {
    document.getElementById('chatHeaderBtn')
        .addEventListener('click', () => openChatPanel(renderChat));
}

/** Рендерит чат в container (#panelContent) */
function renderChat(container) {
    container.innerHTML = `
        <div class="chat-head">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>ИИ-ассистент <em>Зотов.Навигатор</em></span>
        </div>
        ${faqDone ? '' : `<div class="chat-faq">${FAQ.map(q => `<button class="chat-chip">${esc(q)}</button>`).join('')}</div>`}
        <div class="chat-msgs"></div>
        <div class="chat-input-row">
            <input class="chat-input" type="text" placeholder="Задайте вопрос…" autocomplete="off" maxlength="500">
            <button class="chat-send" aria-label="Отправить">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
            </button>
        </div>`;

    const msgsEl = container.querySelector('.chat-msgs');
    const input  = container.querySelector('.chat-input');
    const send   = container.querySelector('.chat-send');

    // Восстановить историю или показать приветствие
    if (stored.length === 0) {
        push(msgsEl, 'assistant', 'Привет! Я ИИ-ассистент Центра «Зотов». Помогу найти нужную зону, расскажу о мероприятиях и построю маршрут прямо на 3D-карте.');
    } else {
        stored.forEach(m => bubble(msgsEl, m.role, m.content));
        msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    // FAQ чипы
    container.querySelectorAll('.chat-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            faqDone = true;
            container.querySelector('.chat-faq')?.remove();
            doSend(chip.textContent.trim(), msgsEl, input);
        });
    });

    // Отправка
    const go = () => {
        const t = input.value.trim();
        if (!t) return;
        input.value = '';
        doSend(t, msgsEl, input);
    };
    send.addEventListener('click', go);
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go(); }
    });

    input.focus();
}

// ---------------------------------------------------------------------------
// Отправка сообщения
// ---------------------------------------------------------------------------
async function doSend(text, msgsEl, input) {
    input.disabled = true;

    // Если есть pendingToId и пользователь сообщил начальную точку — обрабатываем локально
    if (pendingToId !== null) {
        const fromId = resolveFromText(text);
        if (fromId) {
            push(msgsEl, 'user', text);
            pendingToId = null;
            await buildAndShowRoute(fromId, null /* будет запросить toId далее */, msgsEl);
            // В данном случае fromId задан, toId нет — просто сохраним историю и продолжим
            input.disabled = false;
            input.focus();
            return;
        }
    }

    push(msgsEl, 'user', text);
    const typing = bubble(msgsEl, 'assistant', '…', true);
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text, history: stored.slice(0, -1) }),
        });
        const data = await res.json();
        typing.remove();

        // reply может быть пустой строкой если ответ состоял только из {{NAV:...}}
        if (data.reply) {
            push(msgsEl, 'assistant', data.reply);
        }

        // Навигационный intent: строим маршрут в 3D
        if (data.navIntent?.toId) {
            const fromId = data.navIntent.fromId ?? null;
            await buildAndShowRoute(fromId, data.navIntent.toId, msgsEl);
        } else if (!data.reply) {
            // Нет ни текста, ни маршрута — что-то пошло не так
            bubble(msgsEl, 'assistant', 'Нет ответа от сервера.');
        }

    } catch {
        typing.remove();
        bubble(msgsEl, 'assistant', 'Ошибка соединения. Пожалуйста, обратитесь к ресепшену.');
    }

    input.disabled = false;
    input.focus();
    msgsEl.scrollTop = msgsEl.scrollHeight;
}

// ---------------------------------------------------------------------------
// Построить маршрут и показать статус в чате
// ---------------------------------------------------------------------------
async function buildAndShowRoute(fromIdOverride, toId, msgsEl) {
    const startId = getStartZoneId();

    // Если нет ни fromId, ни startZoneId — просим пользователя указать точку
    if (!fromIdOverride && !startId) {
        pendingToId = toId;
        bubble(msgsEl, 'route-hint',
            '📍 Укажите начальную точку: нажмите на зону на 3D-карте или напишите, где вы сейчас находитесь.');
        msgsEl.scrollTop = msgsEl.scrollHeight;
        return;
    }

    const routeEl = bubble(msgsEl, 'route-hint', '⏳ Строю маршрут…');
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
        const resp = await drawRouteOnly(toId, fromIdOverride);
        const from = resp.steps[0].zoneName;
        const to   = resp.steps[resp.steps.length - 1].zoneName;
        routeEl.textContent = `✅ Маршрут построен: ${from} → ${to} (${resp.steps.length} шагов). Следуйте по подсвеченным зонам на карте.`;
        routeEl.classList.add('chat-msg--route-ok');
        pendingToId = null;
    } catch (e) {
        routeEl.textContent = `⚠️ Не удалось построить маршрут: ${e.message}. Попробуйте нажать на зону на карте.`;
        routeEl.classList.add('chat-msg--route-err');
    }
    msgsEl.scrollTop = msgsEl.scrollHeight;
}

// ---------------------------------------------------------------------------
// Попытка разобрать текст пользователя как указание начальной зоны
// ---------------------------------------------------------------------------
const ZONE_KEYWORDS = {
    'магазин': 2, 'кафе': 2, 'касса': 2, 'вход': 2, 'ресепшен': 2, 'форум': 2,
    'гардероб': 8, 'туалет': 9,
    'выставк': 11, 'зал a': 11, 'зал б': 11, 'зал b': 11,
    'кинозал': 26, 'кино': 26, 'кинотеатр': 26,
    'лекторий': 28, 'лекци': 28,
    'мастерска': 36,
    '1 этаж': 2, '1-й этаж': 2, 'первый этаж': 2,
    '2 этаж': 11, '2-й этаж': 11, 'второй этаж': 11,
    '3 этаж': 20, '3-й этаж': 20, 'третий этаж': 20,
    '4 этаж': 26, '4-й этаж': 26, 'четвёртый этаж': 26,
};

function resolveFromText(text) {
    const lower = text.toLowerCase();
    for (const [kw, id] of Object.entries(ZONE_KEYWORDS)) {
        if (lower.includes(kw)) return id;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function push(msgsEl, role, content) {
    stored.push({ role, content });
    bubble(msgsEl, role, content);
}

function bubble(msgsEl, role, text, typing = false) {
    const el = document.createElement('div');
    el.className = `chat-msg chat-msg--${role}${typing ? ' chat-msg--typing' : ''}`;
    el.textContent = text;
    msgsEl.appendChild(el);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return el;
}

function esc(s) {
    return String(s).replace(/[&<>"]/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
