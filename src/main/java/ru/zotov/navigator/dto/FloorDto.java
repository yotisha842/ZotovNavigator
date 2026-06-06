package ru.zotov.navigator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ru.zotov.navigator.model.Floor;

import java.util.List;

/**
 * Этаж для выдачи в API. Список зон заполняется только в детальной выдаче {@code /floors/{id}}.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FloorDto {

    private Long id;
    private int number;
    private String name;
    private double heightMeters;
    private double radiusMeters;
    private String color;
    private String description;
    private List<ZoneDto> zones;

    /** Маппинг без зон (для списка этажей). */
    public static FloorDto summary(Floor floor) {
        return FloorDto.builder()
                .id(floor.getId())
                .number(floor.getNumber())
                .name(floor.getName())
                .heightMeters(floor.getHeightMeters())
                .radiusMeters(floor.getRadiusMeters())
                .color(floor.getColor())
                .description(floor.getDescription())
                .build();
    }

    /** Маппинг с зонами (для детальной выдачи этажа). */
    public static FloorDto withZones(Floor floor, List<ZoneDto> zones) {
        FloorDto dto = summary(floor);
        dto.setZones(zones);
        return dto;
    }
}
