package ru.zotov.navigator.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Открывает CORS для всех источников на эндпоинтах {@code /api/**}.
 *
 * <p>Нужно для встраивания навигатора как виджета (iframe / WordPress-блок) и для
 * локальной разработки фронтенда отдельно от бэкенда.</p>
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*");
    }
}
