package ru.zotov.navigator;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Точка входа приложения «Зотов.Навигатор».
 *
 * <p>Поднимает Spring Boot контекст: REST API под {@code /api}, статический фронтенд
 * из {@code resources/static}, H2 in-memory базу с сидингом из {@code data.sql}
 * и Swagger UI на {@code /swagger-ui.html}.</p>
 */
@SpringBootApplication
public class ZotovNavigatorApplication {

    public static void main(String[] args) {
        SpringApplication.run(ZotovNavigatorApplication.class, args);
    }
}
