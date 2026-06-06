package ru.zotov.navigator.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.zotov.navigator.dto.ZoneDto;
import ru.zotov.navigator.exception.NotFoundException;
import ru.zotov.navigator.model.Zone;
import ru.zotov.navigator.model.ZoneType;
import ru.zotov.navigator.repository.ZoneRepository;

import java.util.List;

/**
 * Чтение зон с фильтрацией по этажу и типу.
 */
@Service
@Transactional(readOnly = true)
public class ZoneService {

    private final ZoneRepository zoneRepository;

    public ZoneService(ZoneRepository zoneRepository) {
        this.zoneRepository = zoneRepository;
    }

    /** Все зоны с опциональными фильтрами по типу и этажу. */
    public List<ZoneDto> getZones(ZoneType type, Long floorId) {
        List<Zone> zones;
        if (type != null && floorId != null) {
            zones = zoneRepository.findByFloorIdAndType(floorId, type);
        } else if (type != null) {
            zones = zoneRepository.findByType(type);
        } else if (floorId != null) {
            zones = zoneRepository.findByFloorId(floorId);
        } else {
            zones = zoneRepository.findAll();
        }
        return zones.stream().map(ZoneDto::from).toList();
    }

    public ZoneDto getZone(Long id) {
        Zone zone = zoneRepository.findById(id)
                .orElseThrow(() -> NotFoundException.of("Зона", id));
        return ZoneDto.from(zone);
    }
}
