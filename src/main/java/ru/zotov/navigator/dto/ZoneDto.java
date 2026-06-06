package ru.zotov.navigator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ru.zotov.navigator.model.Zone;

/**
 * Зона для выдачи в API (без обратной ссылки на JPA-сущность этажа).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ZoneDto {

    private Long id;
    private String name;
    private String type;
    private Long floorId;
    private int floorNumber;
    private double angleStart;
    private double angleEnd;
    private double radiusInner;
    private double radiusOuter;
    private String color;
    private String description;
    private String iconKey;

    /** Маппинг сущности {@link Zone} в DTO. */
    public static ZoneDto from(Zone zone) {
        return ZoneDto.builder()
                .id(zone.getId())
                .name(zone.getName())
                .type(zone.getType().name())
                .floorId(zone.getFloor().getId())
                .floorNumber(zone.getFloor().getNumber())
                .angleStart(zone.getAngleStart())
                .angleEnd(zone.getAngleEnd())
                .radiusInner(zone.getRadiusInner())
                .radiusOuter(zone.getRadiusOuter())
                .color(zone.getColor())
                .description(zone.getDescription())
                .iconKey(zone.getIconKey())
                .build();
    }
}
