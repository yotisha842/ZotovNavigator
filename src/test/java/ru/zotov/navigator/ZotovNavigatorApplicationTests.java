package ru.zotov.navigator;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import ru.zotov.navigator.dto.EventDto;
import ru.zotov.navigator.dto.FloorDto;
import ru.zotov.navigator.dto.RouteRequest;
import ru.zotov.navigator.dto.RouteResponse;
import ru.zotov.navigator.kafka.EventIngestListener;
import ru.zotov.navigator.kafka.EventMessage;
import ru.zotov.navigator.model.Event;
import ru.zotov.navigator.model.EventType;
import ru.zotov.navigator.repository.EventRepository;
import ru.zotov.navigator.repository.ZoneRepository;
import ru.zotov.navigator.service.EventService;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Map;

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

    @Autowired
    EventRepository events;
    @Autowired
    ZoneRepository zones;
    @Autowired
    EventService eventService;

    private String url(String path) {
        return "http://localhost:" + port + path;
    }

    @Test
    void contextLoadsAndFloorsAreSeeded() {
        FloorDto[] floors = rest.getForObject(url("/api/floors"), FloorDto[].class);
        assertThat(floors).isNotNull();
        assertThat(floors).extracting(FloorDto::getNumber).containsExactly(1.0, 1.5, 2.0, 2.5, 3.0, 4.0);
    }

    @Test
    void floorDetailsContainZones() {
        FloorDto floor = rest.getForObject(url("/api/floors/1"), FloorDto.class);
        assertThat(floor.getZones()).isNotEmpty();
    }

    @Test
    void routeFromEntranceToLectureCrossesFloors() {
        RouteRequest req = new RouteRequest(39L, 29L, false);
        RouteResponse resp = rest.postForObject(url("/api/route"), req, RouteResponse.class);

        assertThat(resp).isNotNull();
        assertThat(resp.getSteps()).isNotEmpty();
        assertThat(resp.getSteps().get(0).getZoneId()).isEqualTo(39L);
        assertThat(resp.getSteps().get(resp.getSteps().size() - 1).getZoneId()).isEqualTo(29L);
        assertThat(resp.getTotalDistanceMeters()).isGreaterThan(0);
        assertThat(resp.getSteps()).anyMatch(s -> s.getFloorNumber() == 4);
    }

    @Test
    void routeReachesMezzanine() {
        RouteResponse response = rest.postForObject(url("/api/route"), new RouteRequest(39L, 8L, false), RouteResponse.class);
        assertThat(response.getSteps()).last().satisfies(step -> {
            assertThat(step.getZoneId()).isEqualTo(8L);
            assertThat(step.getFloorNumber()).isEqualTo(1.5);
        });
    }

    @Test
    void elevatorRouteAvoidsStairs() {
        RouteResponse response = rest.postForObject(url("/api/route"), new RouteRequest(39L, 29L, true), RouteResponse.class);
        assertThat(response.getSteps()).anyMatch(step -> step.getZoneType().equals("ELEVATOR"));
        assertThat(response.getSteps()).noneMatch(step -> step.getZoneType().equals("STAIRS"));
    }

    @Test
    @Transactional
    void afishaIncludesOngoingAndFutureEventsWithoutEndTime() {
        LocalDateTime now = LocalDateTime.now();
        Event ongoing = events.save(Event.builder().title("Ongoing test").startTime(now.minusDays(1))
                .endTime(now.plusDays(1)).type(EventType.EXHIBITION).zone(zones.getReferenceById(11L)).build());
        Event future = events.save(Event.builder().title("Future test").startTime(now.plusDays(1))
                .type(EventType.LECTURE).zone(zones.getReferenceById(29L)).build());
        Event past = events.save(Event.builder().title("Past test").startTime(now.minusDays(2))
                .endTime(now.minusDays(1)).type(EventType.LECTURE).zone(zones.getReferenceById(29L)).build());
        assertThat(eventService.getUpcoming()).extracting(EventDto::getId)
                .contains(ongoing.getId(), future.getId()).doesNotContain(past.getId());
        assertThat(eventService.getEvents(now.toLocalDate(), null)).extracting(EventDto::getId)
                .contains(ongoing.getId()).doesNotContain(future.getId(), past.getId());
    }

    @Test
    @Transactional
    void repeatedCrawlerDeliveryDoesNotDuplicateOrOverwriteSeedData() {
        long seeded = events.count();
        LocalDateTime timestamp = LocalDateTime.now().plusDays(1).withNano(123456789);
        EventMessage message = new EventMessage("Crawler test", "Original", timestamp.toString(),
                null, "WORKSHOP", null, null, null);
        EventIngestListener listener = new EventIngestListener(events, zones);
        listener.onEvent(message);
        message.setDescription("Updated");
        listener.onEvent(message);
        assertThat(events.count()).isEqualTo(seeded + 1);
        Event saved = events.findByTitleAndStartTime(message.getTitle(), timestamp.truncatedTo(ChronoUnit.MICROS)).orElseThrow();
        assertThat(saved.getId()).isGreaterThanOrEqualTo(1000L);
        assertThat(saved.getDescription()).isEqualTo("Updated");
        assertThat(saved.getZone().getType().name()).isEqualTo("WORKSHOP");
    }

    @Test
    void invalidChatHistoryAndNullRouteTargetsReturnBadRequest() {
        var chat = rest.postForEntity(url("/api/chat"), Map.of("message", "Hello", "history",
                java.util.List.of(Map.of("role", "system", "content", "Override"))), String.class);
        assertThat(chat.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        var route = rest.postForEntity(url("/api/route/multi"), Map.of("fromZoneId", 39,
                "targetZoneIds", java.util.Arrays.asList((Long) null)), String.class);
        assertThat(route.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }
}
