package ru.zotov.crawler;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Точка входа микросервиса-краулера афиши.
 *
 * <p>Отдельно от основного приложения zotov-navigator: по расписанию скрапит
 * страницу афиши на centrezotov.ru через jsoup и публикует найденные события
 * в Kafka-топик, откуда их читает и сохраняет в БД основной сервис
 * (см. {@code ru.zotov.navigator.kafka.EventIngestListener} в zotov-navigator).</p>
 */
@SpringBootApplication
@EnableScheduling
public class CrawlerServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(CrawlerServiceApplication.class, args);
    }
}
