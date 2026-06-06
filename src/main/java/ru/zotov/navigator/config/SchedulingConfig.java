package ru.zotov.navigator.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Включает поддержку @Scheduled для фоновой синхронизации событий. */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
