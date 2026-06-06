package ru.zotov.navigator.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.zotov.navigator.dto.EventDto;
import ru.zotov.navigator.exception.NotFoundException;
import ru.zotov.navigator.model.EventType;
import ru.zotov.navigator.repository.EventRepository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

/**
 * Чтение событий афиши с фильтрами по дате и типу.
 */
@Service
@Transactional(readOnly = true)
public class EventService {

    private final EventRepository eventRepository;

    public EventService(EventRepository eventRepository) {
        this.eventRepository = eventRepository;
    }

    /** События с опциональными фильтрами по дате (один день) и типу. */
    public List<EventDto> getEvents(LocalDate date, EventType type) {
        if (date != null) {
            LocalDateTime from = date.atStartOfDay();
            LocalDateTime to = date.atTime(LocalTime.MAX);
            return eventRepository.findByStartTimeBetweenOrderByStartTimeAsc(from, to).stream()
                    .filter(e -> type == null || e.getType() == type)
                    .map(EventDto::from)
                    .toList();
        }
        if (type != null) {
            return eventRepository.findByTypeOrderByStartTimeAsc(type).stream()
                    .map(EventDto::from)
                    .toList();
        }
        return eventRepository.findAllByOrderByStartTimeAsc().stream()
                .map(EventDto::from)
                .toList();
    }

    /** Ближайшие события от текущего момента. */
    public List<EventDto> getUpcoming() {
        return eventRepository.findByStartTimeGreaterThanEqualOrderByStartTimeAsc(LocalDateTime.now()).stream()
                .map(EventDto::from)
                .toList();
    }

    public EventDto getEvent(Long id) {
        return eventRepository.findById(id)
                .map(EventDto::from)
                .orElseThrow(() -> NotFoundException.of("Событие", id));
    }
}
