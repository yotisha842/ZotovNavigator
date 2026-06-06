package ru.zotov.navigator.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Разрешает встраивание навигатора через iframe.
 *
 * <p>По умолчанию разрешены все источники ({@code frame-ancestors *}).
 * В продакшне ограничить через {@code zotov.embed.allowed-origins}.</p>
 */
@Configuration
public class EmbedConfig {

    @Value("${zotov.embed.allowed-origins:*}")
    private String allowedOrigins;

    @Bean
    public OncePerRequestFilter frameOptionsFilter() {
        return new OncePerRequestFilter() {
            @Override
            protected void doFilterInternal(HttpServletRequest request,
                                            HttpServletResponse response,
                                            FilterChain chain)
                    throws ServletException, IOException {
                // Разрешаем iframe — убираем DENY, ставим CSP frame-ancestors
                response.setHeader("Content-Security-Policy",
                        "frame-ancestors " + allowedOrigins);
                // X-Frame-Options не совместим с wildcard в некоторых браузерах,
                // используем только CSP (поддерживается всеми современными браузерами)
                response.setHeader("X-Frame-Options", "ALLOWALL");
                chain.doFilter(request, response);
            }
        };
    }
}
