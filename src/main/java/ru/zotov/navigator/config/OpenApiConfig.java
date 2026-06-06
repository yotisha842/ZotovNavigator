package ru.zotov.navigator.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Метаданные OpenAPI/Swagger для документации REST API.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI zotovOpenAPI() {
        return new OpenAPI().info(new Info()
                .title("Зотов.Навигатор API")
                .description("REST API цифровой навигации по Центру «Зотов»: этажи, зоны, события, маршруты, поиск.")
                .version("0.1.0")
                .license(new License().name("Hackathon prototype")));
    }
}
