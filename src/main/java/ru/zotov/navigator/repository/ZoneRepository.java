package ru.zotov.navigator.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.zotov.navigator.model.Zone;
import ru.zotov.navigator.model.ZoneType;

import java.util.List;

/**
 * Доступ к зонам.
 */
public interface ZoneRepository extends JpaRepository<Zone, Long> {

    List<Zone> findByFloorId(Long floorId);

    List<Zone> findByType(ZoneType type);

    List<Zone> findByFloorIdAndType(Long floorId, ZoneType type);

    List<Zone> findByNameContainingIgnoreCase(String query);
}
