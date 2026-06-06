// Тонкие обёртки над REST API бэкенда. Всё общение с сервером — здесь.

const BASE = '/api';

async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
    return res.json();
}

async function postJson(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || `POST ${url} → ${res.status}`);
    }
    return res.json();
}

export const api = {
    floors: () => getJson(`${BASE}/floors`),
    floor: (id) => getJson(`${BASE}/floors/${id}`),
    zones: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return getJson(`${BASE}/zones${qs ? '?' + qs : ''}`);
    },
    zone: (id) => getJson(`${BASE}/zones/${id}`),
    events: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return getJson(`${BASE}/events${qs ? '?' + qs : ''}`);
    },
    upcoming: () => getJson(`${BASE}/events/upcoming`),
    search: (q) => getJson(`${BASE}/search?q=${encodeURIComponent(q)}`),
    route: (fromZoneId, toZoneId, preferElevator = false) =>
        postJson(`${BASE}/route`, { fromZoneId, toZoneId, preferElevator }),
    routeMulti: (fromZoneId, targetZoneIds, optimize = true, preferElevator = false) =>
        postJson(`${BASE}/route/multi`, { fromZoneId, targetZoneIds, optimize, preferElevator }),
};
