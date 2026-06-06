package ru.zotov.navigator.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Результат глобального поиска: совпавшие зоны и события.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SearchResultDto {

    private String query;
    private List<ZoneDto> zones;
    private List<EventDto> events;
}
