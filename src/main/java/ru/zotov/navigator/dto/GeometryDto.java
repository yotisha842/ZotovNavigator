package ru.zotov.navigator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Геометрия сектора кольца — используется фронтендом для рендера зоны/шага маршрута.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GeometryDto {
    private double angleStart;
    private double angleEnd;
    private double radiusInner;
    private double radiusOuter;
}
