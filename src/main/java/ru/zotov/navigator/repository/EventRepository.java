package ru.zotov.navigator.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.zotov.navigator.model.Event;
import ru.zotov.navigator.model.EventType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Доступ к событиям афиши.
 */
public interface EventRepository extends JpaRepository<Event, Long> {

    List<Event> findByStartTimeGreaterThanEqualOrderByStartTimeAsc(LocalDateTime from);

    List<Event> findByEndTimeGreaterThanEqualOrderByStartTimeAsc(LocalDateTime now);

    List<Event> findByTypeOrderByStartTimeAsc(EventType type);

    List<Event> findByStartTimeBetweenOrderByStartTimeAsc(LocalDateTime from, LocalDateTime to);

    List<Event> findByTitleContainingIgnoreCase(String query);

    List<Event> findAllByOrderByStartTimeAsc();

    /** Для upsert событий, приходящих из Kafka (краулер афиши): дедупликация по названию и началу. */
    Optional<Event> findByTitleAndStartTime(String title, LocalDateTime startTime);
}
