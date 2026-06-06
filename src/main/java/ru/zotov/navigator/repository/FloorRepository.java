package ru.zotov.navigator.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.zotov.navigator.model.Floor;

import java.util.List;

/**
 * Доступ к этажам.
 */
public interface FloorRepository extends JpaRepository<Floor, Long> {

    List<Floor> findAllByOrderByNumberAsc();
}
