package ru.zotov.navigator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import ru.zotov.navigator.model.Event;

import java.time.LocalDateTime;

/**
 * Событие афиши для выдачи в API с минимально нужной информацией о зоне.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventDto {

    private Long id;
    private String title;
    private String description;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private String type;
    private String posterUrl;
    private Long zoneId;
    private String zoneName;
    private double floorNumber;

    public static EventDto from(Event event) {
        return EventDto.builder()
                .id(event.getId())
                .title(event.getTitle())
                .description(event.getDescription())
                .startTime(event.getStartTime())
                .endTime(event.getEndTime())
                .type(event.getType().name())
                .posterUrl(event.getPosterUrl())
                .zoneId(event.getZone().getId())
                .zoneName(event.getZone().getName())
                .floorNumber(event.getZone().getFloor().getNumber())
                .build();
    }
}
