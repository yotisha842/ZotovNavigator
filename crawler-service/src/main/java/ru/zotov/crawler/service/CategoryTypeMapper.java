package ru.zotov.crawler.service;

/**
 * Сопоставление русской категории с сайта афиши ("Выставка", "Экскурсия" и т.д.)
 * с именем константы {@code ru.zotov.navigator.model.EventType} на стороне основного сервиса.
 * Строковый контракт вместо общей библиотеки — сервисы независимы и не делят код.
 */
final class CategoryTypeMapper {

    private CategoryTypeMapper() {
    }

    static String toEventType(String category) {
        if (category == null || category.isBlank()) {
            return "OTHER";
        }
        String c = category.toLowerCase();
        if (c.contains("выстав")) {
            return "EXHIBITION";
        }
        if (c.contains("кино") || c.contains("фильм") || c.contains("показ")) {
            return "FILM";
        }
        if (c.contains("лекц")) {
            return "LECTURE";
        }
        if (c.contains("конц") || c.contains("спектак") || c.contains("перформ")) {
            return "CONCERT";
        }
        if (c.contains("мастер")) {
            return "WORKSHOP";
        }
        return "OTHER";
    }
}
