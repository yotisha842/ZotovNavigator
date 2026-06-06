package ru.zotov.navigator.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.zotov.navigator.dto.FloorDto;
import ru.zotov.navigator.service.FloorService;

import java.util.List;

/**
 * Этажи здания.
 */
@RestController
@RequestMapping("/api/floors")
@Tag(name = "Floors", description = "Этажи здания")
public class FloorController {

    private final FloorService floorService;

    public FloorController(FloorService floorService) {
        this.floorService = floorService;
    }

    @GetMapping
    @Operation(summary = "Все этажи")
    public List<FloorDto> getFloors() {
        return floorService.getAllFloors();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Этаж с его зонами")
    public FloorDto getFloor(@PathVariable Long id) {
        return floorService.getFloorWithZones(id);
    }
}
