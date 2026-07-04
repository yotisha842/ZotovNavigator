package ru.zotov.crawler.service;

import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ru.zotov.crawler.model.ScrapedEvent;

import java.io.IOException;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Скрапинг страницы афиши Центра «Зотов» (centrezotov.ru/events/) через jsoup.
 *
 * <p>Карточка события на сайте — {@code <div class="catalog-card">}: внутри лежит
 * ссылка-превью с картинкой ({@code .catalog-card__img}, реальный URL — в {@code data-src},
 * т.к. изображение лениво подгружается) и ссылка-инфо ({@code .catalog-card__info}) с
 * диапазоном дат ({@code .catalog-card__date}), категорией ({@code .catalog-card__tag})
 * и заголовком ({@code .catalog-card__sub}). Разметка сайта может со временем поменяться —
 * любая ошибка разбора отдельной карточки или недоступность сайта не должна ронять сервис,
 * поэтому весь метод работает по принципу "лучшее, что смогли распарсить, плюс пропуск того,
 * что не подошло".</p>
 */
@Slf4j
@Service
public class AfishaScraperService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd.MM.uu", Locale.ROOT);
    private static final Pattern DATE_PATTERN = Pattern.compile("\\d{2}\\.\\d{2}\\.\\d{2}");
    private static final LocalTime OPENING_TIME = LocalTime.of(11, 0);
    private static final LocalTime CLOSING_TIME = LocalTime.of(22, 0);

    private final String afishaUrl;

    public AfishaScraperService(@Value("${app.crawler.afisha-url}") String afishaUrl) {
        this.afishaUrl = afishaUrl;
    }

    /** Возвращает найденные на странице события; при любой ошибке — пустой список, не бросает исключение. */
    public List<ScrapedEvent> scrape() {
        Document doc;
        try {
            doc = Jsoup.connect(afishaUrl)
                    .userAgent("Mozilla/5.0 (compatible; ZotovNavigatorCrawler/1.0)")
                    .timeout(10_000)
                    .get();
        } catch (IOException | RuntimeException e) {
            log.warn("Не удалось загрузить афишу с {}: {}", afishaUrl, e.getMessage());
            return List.of();
        }

        Elements cards = doc.select("div.catalog-card");
        List<ScrapedEvent> events = new ArrayList<>();
        for (Element card : cards) {
            try {
                parseCard(card).ifPresent(events::add);
            } catch (RuntimeException e) {
                log.debug("Пропускаю нераспознанную карточку афиши: {}", e.getMessage());
            }
        }
        log.info("Афиша {}: найдено {} карточек, распознано {} событий", afishaUrl, cards.size(), events.size());
        return events;
    }

    private java.util.Optional<ScrapedEvent> parseCard(Element card) {
        Element titleEl = card.selectFirst(".catalog-card__sub");
        if (titleEl == null || titleEl.text().isBlank()) {
            return java.util.Optional.empty();
        }
        String title = titleEl.text().trim();

        Element dateEl = card.selectFirst(".catalog-card__date");
        Element categoryEl = card.selectFirst(".catalog-card__tag");
        String dateText = dateEl != null ? dateEl.text().trim() : "";
        String categoryText = categoryEl != null ? categoryEl.text().trim() : "";

        LocalDate[] dates = parseDates(dateText);
        if (dates == null) {
            return java.util.Optional.empty();
        }

        Element linkEl = card.selectFirst("a.catalog-card__info");
        String sourceUrl = linkEl != null ? linkEl.absUrl("href") : null;

        Element imgEl = card.selectFirst(".catalog-card__img img");
        String posterUrl = extractPosterUrl(imgEl);

        return java.util.Optional.of(new ScrapedEvent(
                title,
                categoryText,
                dates[0].atTime(OPENING_TIME),
                dates[1] != null ? dates[1].atTime(CLOSING_TIME) : null,
                posterUrl,
                sourceUrl == null || sourceUrl.isBlank() ? null : sourceUrl
        ));
    }

    /** Картинки на сайте лениво подгружаются: реальный URL — в data-src, а не в src (там placeholder). */
    private String extractPosterUrl(Element imgEl) {
        if (imgEl == null) {
            return null;
        }
        if (!imgEl.attr("data-src").isBlank()) {
            return imgEl.absUrl("data-src");
        }
        String src = imgEl.attr("src");
        return (src.isBlank() || src.startsWith("data:")) ? null : imgEl.absUrl("src");
    }

    /** Разбирает "26.06.26 - 23.08.26" или одиночную дату "08.06.26". Возвращает null, если дат нет вовсе. */
    private LocalDate[] parseDates(String dateText) {
        Matcher matcher = DATE_PATTERN.matcher(dateText);
        List<LocalDate> found = new ArrayList<>();
        while (matcher.find()) {
            try {
                found.add(LocalDate.parse(matcher.group(), DATE_FORMAT));
            } catch (DateTimeParseException ignored) {
                // пропускаем нераспознанный фрагмент даты
            }
        }
        if (found.isEmpty()) {
            return null;
        }
        LocalDate start = found.get(0);
        LocalDate end = found.size() > 1 ? found.get(1) : null;
        return new LocalDate[] { start, end };
    }
}
