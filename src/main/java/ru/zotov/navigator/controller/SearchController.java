package ru.zotov.navigator.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.zotov.navigator.dto.SearchResultDto;
import ru.zotov.navigator.service.SearchService;

/**
 * Глобальный поиск по зонам и событиям.
 */
@RestController
@RequestMapping("/api/search")
@Tag(name = "Search", description = "Поиск по зонам и событиям")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @GetMapping
    @Operation(summary = "Поиск по названиям зон и событий")
    public SearchResultDto search(@RequestParam("q") String query) {
        return searchService.search(query);
    }
}
