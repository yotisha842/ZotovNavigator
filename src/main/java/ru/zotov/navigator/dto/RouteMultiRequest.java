package ru.zotov.navigator.dto;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Запрос на маршрут через несколько точек («план дня»).
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RouteMultiRequest {

    @NotNull
    private Long fromZoneId;

    /** Зоны, которые нужно посетить. */
    @NotEmpty
    private List<Long> targetZoneIds;

    /** Оптимизировать порядок обхода (greedy ближайший сосед). */
    private boolean optimize = true;

    private boolean preferElevator;
}
