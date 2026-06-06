package ru.zotov.navigator.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import ru.zotov.navigator.dto.RouteMultiRequest;
import ru.zotov.navigator.dto.RouteRequest;
import ru.zotov.navigator.dto.RouteResponse;
import ru.zotov.navigator.service.RouteService;

/**
 * Построение маршрутов.
 */
@RestController
@RequestMapping("/api/route")
@Tag(name = "Route", description = "Маршруты по зданию")
public class RouteController {

    private final RouteService routeService;

    public RouteController(RouteService routeService) {
        this.routeService = routeService;
    }

    @PostMapping
    @Operation(summary = "Маршрут из зоны A в зону B")
    public RouteResponse route(@Valid @RequestBody RouteRequest request) {
        return routeService.route(request);
    }

    @PostMapping("/multi")
    @Operation(summary = "Маршрут через несколько точек (план дня)")
    public RouteResponse routeMulti(@Valid @RequestBody RouteMultiRequest request) {
        return routeService.routeMulti(request);
    }
}
