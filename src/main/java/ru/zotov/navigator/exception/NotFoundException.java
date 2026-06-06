package ru.zotov.navigator.exception;

/**
 * Сущность не найдена — мапится в HTTP 404.
 */
public class NotFoundException extends RuntimeException {

    public NotFoundException(String message) {
        super(message);
    }

    public static NotFoundException of(String entity, Object id) {
        return new NotFoundException(entity + " с id=" + id + " не найден(а)");
    }
}
