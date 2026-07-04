package ru.zotov.navigator.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.zotov.navigator.model.Event;
import ru.zotov.navigator.model.EventType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Доступ к событиям афиши.
 */
public interface EventRepository extends JpaRepository<Event, Long> {

    @Query("select e from Event e where e.endTime >= :now "
            + "or (e.endTime is null and e.startTime >= :now) order by e.startTime")
    List<Event> findUpcoming(@Param("now") LocalDateTime now);

    List<Event> findByTypeOrderByStartTimeAsc(EventType type);

    @Query("select e from Event e where e.startTime <= :to "
            + "and (e.endTime >= :from or (e.endTime is null and e.startTime >= :from)) order by e.startTime")
    List<Event> findOverlapping(@Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    List<Event> findByTitleContainingIgnoreCase(String query);

    List<Event> findAllByOrderByStartTimeAsc();

    /** Для upsert событий, приходящих из Kafka (краулер афиши): дедупликация по названию и началу. */
    Optional<Event> findByTitleAndStartTime(String title, LocalDateTime startTime);
}
