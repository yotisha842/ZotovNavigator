package ru.zotov.navigator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Ответ с построенным маршрутом: суммарные метрики + упорядоченные шаги.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RouteResponse {

    private double totalDistanceMeters;
    private int estimatedSeconds;
    private List<RouteStep> steps;
}
