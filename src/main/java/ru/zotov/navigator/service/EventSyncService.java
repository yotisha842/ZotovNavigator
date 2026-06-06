package ru.zotov.navigator.service;

/**
 * Контракт синхронизации событий из внешнего источника.
 * Реализации: {@link ScraperEventSyncService} (парсер), в будущем — ElmaEventSyncService.
 */
public interface EventSyncService {

    /**
     * Синхронизирует события и возвращает количество новых записей.
     */
    int syncEvents();
}
