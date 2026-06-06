package ru.zotov.navigator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Один шаг маршрута — зона и текстовая инструкция к ней.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RouteStep {

    private Long zoneId;
    private String zoneName;
    private int floorNumber;
    private String zoneType;
    private String instruction;
    private GeometryDto geometry;
}
