package ru.zotov.navigator.model;

/** Источник, из которого пришло событие в базу. */
public enum EventSource {
    MANUAL,   // введено вручную или через data.sql
    SCRAPER,  // получено парсером с centrezotov.ru
    ELMA365   // импортировано через ELMA365 REST API
}
