package ru.zotov.navigator.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.zotov.navigator.dto.FloorDto;
import ru.zotov.navigator.dto.ZoneDto;
import ru.zotov.navigator.exception.NotFoundException;
import ru.zotov.navigator.model.Floor;
import ru.zotov.navigator.repository.FloorRepository;
import ru.zotov.navigator.repository.ZoneRepository;

import java.util.List;

/**
 * Чтение этажей и их зон.
 */
@Service
@Transactional(readOnly = true)
public class FloorService {

    private final FloorRepository floorRepository;
    private final ZoneRepository zoneRepository;

    public FloorService(FloorRepository floorRepository, ZoneRepository zoneRepository) {
        this.floorRepository = floorRepository;
        this.zoneRepository = zoneRepository;
    }

    /** Все этажи, отсортированы по номеру. */
    public List<FloorDto> getAllFloors() {
        return floorRepository.findAllByOrderByNumberAsc().stream()
                .map(FloorDto::summary)
                .toList();
    }

    /** Этаж с его зонами. */
    public FloorDto getFloorWithZones(Long id) {
        Floor floor = floorRepository.findById(id)
                .orElseThrow(() -> NotFoundException.of("Этаж", id));
        List<ZoneDto> zones = zoneRepository.findByFloorId(id).stream()
                .map(ZoneDto::from)
                .toList();
        return FloorDto.withZones(floor, zones);
    }
}
