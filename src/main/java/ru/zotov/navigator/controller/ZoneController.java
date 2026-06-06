package ru.zotov.navigator.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import ru.zotov.navigator.dto.ZoneDto;
import ru.zotov.navigator.model.ZoneType;
import ru.zotov.navigator.service.ZoneService;

import java.util.List;

/**
 * Зоны (пространства) этажей.
 */
@RestController
@RequestMapping("/api/zones")
@Tag(name = "Zones", description = "Зоны на этажах")
public class ZoneController {

    private final ZoneService zoneService;

    public ZoneController(ZoneService zoneService) {
        this.zoneService = zoneService;
    }

    @GetMapping
    @Operation(summary = "Все зоны с фильтрами по типу и этажу")
    public List<ZoneDto> getZones(@RequestParam(required = false) ZoneType type,
                                  @RequestParam(required = false) Long floorId) {
        return zoneService.getZones(type, floorId);
    }

    @GetMapping("/{id}")
    @Operation(summary = "Одна зона")
    public ZoneDto getZone(@PathVariable Long id) {
        return zoneService.getZone(id);
    }
}
