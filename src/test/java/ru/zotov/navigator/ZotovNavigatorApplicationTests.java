package ru.zotov.navigator;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import ru.zotov.navigator.dto.FloorDto;
import ru.zotov.navigator.dto.RouteRequest;
import ru.zotov.navigator.dto.RouteResponse;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Базовые интеграционные тесты ключевых эндпоинтов.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ZotovNavigatorApplicationTests {

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    @Test
    void contextLoadsAndFloorsAreSeeded() {
        FloorDto[] floors = rest.getForObject(url("/api/floors"), FloorDto[].class);
        assertThat(floors).isNotNull();
        assertThat(floors).hasSize(5);
        assertThat(floors[0].getNumber()).isEqualTo(1);
    }

    @Test
    void floorDetailsContainZones() {
        FloorDto floor = rest.getForObject(url("/api/floors/1"), FloorDto.class);
        assertThat(floor.getZones()).isNotEmpty();
    }

    @Test
    void routeFromEntranceToLectureCrossesFloors() {
        RouteRequest req = new RouteRequest(1L, 20L, false);
        RouteResponse resp = rest.postForObject(url("/api/route"), req, RouteResponse.class);

        assertThat(resp).isNotNull();
        assertThat(resp.getSteps()).isNotEmpty();
        assertThat(resp.getSteps().get(0).getZoneId()).isEqualTo(1L);
        assertThat(resp.getSteps().get(resp.getSteps().size() - 1).getZoneId()).isEqualTo(20L);
        assertThat(resp.getTotalDistanceMeters()).isGreaterThan(0);
        // маршрут должен подняться с 1-го на 3-й этаж
        assertThat(resp.getSteps()).anyMatch(s -> s.getFloorNumber() == 3);
    }
}
