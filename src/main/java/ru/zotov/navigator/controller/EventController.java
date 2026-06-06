package ru.zotov.navigator.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.zotov.navigator.dto.EventDto;
import ru.zotov.navigator.model.EventType;
import ru.zotov.navigator.service.EventService;

import java.time.LocalDate;
import java.util.List;

/**
 * События афиши.
 */
@RestController
@RequestMapping("/api/events")
@Tag(name = "Events", description = "Афиша мероприятий")
public class EventController {

    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    @GetMapping
    @Operation(summary = "События с фильтрами по дате и типу")
    public List<EventDto> getEvents(@RequestParam(required = false)
                                    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
                                    @RequestParam(required = false) EventType type) {
        return eventService.getEvents(date, type);
    }

    @GetMapping("/upcoming")
    @Operation(summary = "Ближайшие события от текущего момента")
    public List<EventDto> getUpcoming() {
        return eventService.getUpcoming();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Одно событие")
    public EventDto getEvent(@PathVariable Long id) {
        return eventService.getEvent(id);
    }
}
