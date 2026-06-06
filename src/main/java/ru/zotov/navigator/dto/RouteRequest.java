package ru.zotov.navigator.dto;

import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Запрос на построение маршрута из одной зоны в другую.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RouteRequest {

    @NotNull
    private Long fromZoneId;

    @NotNull
    private Long toZoneId;

    /** Предпочесть лифт лестнице при смене этажей. */
    private boolean preferElevator;
}
