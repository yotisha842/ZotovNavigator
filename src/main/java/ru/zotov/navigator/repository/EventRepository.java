package ru.zotov.navigator.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.zotov.navigator.model.Event;
import ru.zotov.navigator.model.EventType;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Доступ к событиям афиши.
 */
public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByStartTimeGreaterThanEqualOrderByStartTimeAsc(LocalDateTime from);

    List<Event> findByTypeOrderByStartTimeAsc(EventType type);

    List<Event> findByStartTimeBetweenOrderByStartTimeAsc(LocalDateTime from, LocalDateTime to);

    List<Event> findByTitleContainingIgnoreCase(String query);

    List<Event> findAllByOrderByStartTimeAsc();
}
