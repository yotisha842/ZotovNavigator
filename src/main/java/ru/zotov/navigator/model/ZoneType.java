package ru.zotov.navigator.model;

/**
 * Тип пространства (зоны) на этаже.
 *
 * <p>{@link #STAIRS} и {@link #ELEVATOR} — служебные зоны вертикальной связи,
 * через них {@code RouteService} соединяет смежные этажи в графе навигации.</p>
 */
public enum ZoneType {
    EXHIBITION,
    CINEMA,
    LECTURE,
    SHOP,
    CAFE,
    PUBLIC,
    ENTRANCE,
    RESTROOM,
    WARDROBE,
    ELEVATOR,
    STAIRS
}
