package ru.zotov.navigator.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.zotov.navigator.dto.GeometryDto;
import ru.zotov.navigator.dto.RouteMultiRequest;
import ru.zotov.navigator.dto.RouteRequest;
import ru.zotov.navigator.dto.RouteResponse;
import ru.zotov.navigator.dto.RouteStep;
import ru.zotov.navigator.exception.NotFoundException;
import ru.zotov.navigator.model.Zone;
import ru.zotov.navigator.model.ZoneType;
import ru.zotov.navigator.repository.ZoneRepository;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.PriorityQueue;
import java.util.Set;

/**
 * Построение маршрутов по графу зон.
 *
 * <p>Граф строится в памяти на каждый запрос (данных мало): вершины — зоны,
 * рёбра внутри этажа — соседние сектора и связь с лестницами/лифтом, рёбра между
 * этажами — зоны вертикальной связи ({@link ZoneType#STAIRS}/{@link ZoneType#ELEVATOR})
 * на смежных этажах. Кратчайший путь ищется алгоритмом Дейкстры.</p>
 */
@Service
@Transactional(readOnly = true)
public class RouteService {

    /** Средняя скорость пешехода в помещении, м/с. */
    private static final double WALK_SPEED = 1.2;
    /** Допуск на «соприкосновение» секторов по углу, градусы. */
    private static final double ANGLE_TOL = 8.0;
    /** Допуск на радиальное перекрытие, метры. */
    private static final double RADIUS_TOL = 1.0;

    private final ZoneRepository zoneRepository;

    public RouteService(ZoneRepository zoneRepository) {
        this.zoneRepository = zoneRepository;
    }

    /** Маршрут из одной зоны в другую. */
    public RouteResponse route(RouteRequest request) {
        Map<Long, Zone> zones = loadZones();
        Zone from = requireZone(zones, request.getFromZoneId());
        Zone to = requireZone(zones, request.getToZoneId());

        Map<Long, List<Edge>> graph = buildGraph(zones, request.isPreferElevator());
        List<Zone> path = dijkstra(graph, zones, from.getId(), to.getId());
        if (path.isEmpty()) {
            throw new NotFoundException("Маршрут между зонами не найден");
        }
        return toResponse(path);
    }

    /**
     * Маршрут через несколько точек («план дня»).
     * При {@code optimize=true} порядок обхода подбирается жадно (ближайший сосед).
     */
    public RouteResponse routeMulti(RouteMultiRequest request) {
        Map<Long, Zone> zones = loadZones();
        Zone start = requireZone(zones, request.getFromZoneId());
        for (Long id : request.getTargetZoneIds()) {
            requireZone(zones, id);
        }

        Map<Long, List<Edge>> graph = buildGraph(zones, request.isPreferElevator());

        List<Long> remaining = new ArrayList<>(new LinkedHashSet<>(request.getTargetZoneIds()));
        List<Zone> fullPath = new ArrayList<>();
        fullPath.add(start);
        Long currentId = start.getId();

        while (!remaining.isEmpty()) {
            Long nextId;
            List<Zone> legToNext;
            if (request.isOptimize()) {
                // выбираем ближайшую недостижённую цель по длине маршрута
                Long best = null;
                List<Zone> bestLeg = null;
                double bestDist = Double.POSITIVE_INFINITY;
                for (Long candidate : remaining) {
                    List<Zone> leg = dijkstra(graph, zones, currentId, candidate);
                    if (leg.isEmpty()) {
                        continue;
                    }
                    double dist = pathLength(leg);
                    if (dist < bestDist) {
                        bestDist = dist;
                        best = candidate;
                        bestLeg = leg;
                    }
                }
                nextId = best;
                legToNext = bestLeg;
            } else {
                nextId = remaining.get(0);
                legToNext = dijkstra(graph, zones, currentId, nextId);
            }

            if (nextId == null || legToNext == null || legToNext.isEmpty()) {
                throw new NotFoundException("Не удалось построить маршрут до одной из точек плана");
            }
            // первый элемент leg — текущая зона, не дублируем
            fullPath.addAll(legToNext.subList(1, legToNext.size()));
            currentId = nextId;
            remaining.remove(nextId);
        }

        return toResponse(fullPath);
    }

    // ----------------------------------------------------------------------
    // Построение графа
    // ----------------------------------------------------------------------

    private Map<Long, Zone> loadZones() {
        Map<Long, Zone> map = new HashMap<>();
        for (Zone z : zoneRepository.findAll()) {
            map.put(z.getId(), z);
        }
        return map;
    }

    private Zone requireZone(Map<Long, Zone> zones, Long id) {
        Zone z = zones.get(id);
        if (z == null) {
            throw NotFoundException.of("Зона", id);
        }
        return z;
    }

    private record Edge(Long to, double weight) {}

    private Map<Long, List<Edge>> buildGraph(Map<Long, Zone> zones, boolean preferElevator) {
        Map<Long, List<Edge>> graph = new HashMap<>();
        List<Zone> all = new ArrayList<>(zones.values());
        for (Zone z : all) {
            graph.put(z.getId(), new ArrayList<>());
        }

        // Рёбра внутри этажа
        for (int i = 0; i < all.size(); i++) {
            for (int j = i + 1; j < all.size(); j++) {
                Zone a = all.get(i);
                Zone b = all.get(j);
                if (a.getFloor().getNumber() != b.getFloor().getNumber()) {
                    continue;
                }
                if (sameFloorConnected(a, b)) {
                    double w = planarDistance(a, b);
                    addEdge(graph, a.getId(), b.getId(), w);
                }
            }
        }

        // Рёбра между этажами через зоны вертикальной связи
        double stairsFactor = preferElevator ? 3.0 : 1.0;
        double elevatorFactor = preferElevator ? 1.0 : 1.5;
        for (int i = 0; i < all.size(); i++) {
            for (int j = i + 1; j < all.size(); j++) {
                Zone a = all.get(i);
                Zone b = all.get(j);
                if (a.getType() != b.getType()) {
                    continue;
                }
                boolean vertical = a.getType() == ZoneType.STAIRS || a.getType() == ZoneType.ELEVATOR;
                if (!vertical) {
                    continue;
                }
                int floorDiff = Math.abs(a.getFloor().getNumber() - b.getFloor().getNumber());
                if (floorDiff != 1) {
                    continue;
                }
                double vertical3d = floorHeight(a);
                double w = (planarDistance(a, b) + vertical3d)
                        * (a.getType() == ZoneType.STAIRS ? stairsFactor : elevatorFactor);
                addEdge(graph, a.getId(), b.getId(), w);
            }
        }
        return graph;
    }

    /** Соседние ли зоны одного этажа: перекрытие секторов либо связь с лестницей/лифтом. */
    private boolean sameFloorConnected(Zone a, Zone b) {
        boolean radialOverlap = a.getRadiusInner() <= b.getRadiusOuter() + RADIUS_TOL
                && b.getRadiusInner() <= a.getRadiusOuter() + RADIUS_TOL;
        boolean angularTouch = a.getAngleStart() <= b.getAngleEnd() + ANGLE_TOL
                && b.getAngleStart() <= a.getAngleEnd() + ANGLE_TOL;
        boolean adjacentSectors = radialOverlap && angularTouch;

        // Зоны вертикальной связи играют роль хабов этажа — соединяем их со всеми зонами,
        // чтобы граф гарантированно был связным и маршрут шёл через коридоры/холлы.
        boolean hubLink = isCirculation(a) || isCirculation(b);
        return adjacentSectors || hubLink;
    }

    private boolean isCirculation(Zone z) {
        return z.getType() == ZoneType.STAIRS
                || z.getType() == ZoneType.ELEVATOR
                || z.getType() == ZoneType.PUBLIC
                || z.getType() == ZoneType.ENTRANCE;
    }

    private void addEdge(Map<Long, List<Edge>> graph, Long a, Long b, double weight) {
        graph.get(a).add(new Edge(b, weight));
        graph.get(b).add(new Edge(a, weight));
    }

    // ----------------------------------------------------------------------
    // Дейкстра
    // ----------------------------------------------------------------------

    private List<Zone> dijkstra(Map<Long, List<Edge>> graph, Map<Long, Zone> zones, Long startId, Long goalId) {
        if (startId.equals(goalId)) {
            return List.of(zones.get(startId));
        }
        Map<Long, Double> dist = new HashMap<>();
        Map<Long, Long> prev = new HashMap<>();
        PriorityQueue<long[]> pq = new PriorityQueue<>(Comparator.comparingDouble(a -> Double.longBitsToDouble(a[1])));
        dist.put(startId, 0.0);
        pq.add(new long[]{startId, Double.doubleToLongBits(0.0)});

        while (!pq.isEmpty()) {
            long[] top = pq.poll();
            Long u = top[0];
            double d = Double.longBitsToDouble(top[1]);
            if (d > dist.getOrDefault(u, Double.POSITIVE_INFINITY)) {
                continue;
            }
            if (u.equals(goalId)) {
                break;
            }
            for (Edge e : graph.getOrDefault(u, List.of())) {
                double nd = d + e.weight();
                if (nd < dist.getOrDefault(e.to(), Double.POSITIVE_INFINITY)) {
                    dist.put(e.to(), nd);
                    prev.put(e.to(), u);
                    pq.add(new long[]{e.to(), Double.doubleToLongBits(nd)});
                }
            }
        }

        if (!prev.containsKey(goalId)) {
            return List.of();
        }
        List<Zone> path = new ArrayList<>();
        Long cur = goalId;
        while (cur != null) {
            path.add(zones.get(cur));
            cur = prev.get(cur);
        }
        Collections.reverse(path);
        return path;
    }

    // ----------------------------------------------------------------------
    // Геометрия и сборка ответа
    // ----------------------------------------------------------------------

    private double[] centerXY(Zone z) {
        double ang = Math.toRadians(z.centerAngle());
        double r = z.centerRadius();
        return new double[]{r * Math.cos(ang), r * Math.sin(ang)};
    }

    private double planarDistance(Zone a, Zone b) {
        double[] pa = centerXY(a);
        double[] pb = centerXY(b);
        return Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
    }

    private double floorHeight(Zone z) {
        double h = z.getFloor().getHeightMeters();
        return h > 0 ? h : 4.0;
    }

    private double pathLength(List<Zone> path) {
        double total = 0;
        for (int i = 1; i < path.size(); i++) {
            Zone prev = path.get(i - 1);
            Zone cur = path.get(i);
            double horizontal = planarDistance(prev, cur);
            double vertical = prev.getFloor().getNumber() != cur.getFloor().getNumber() ? floorHeight(cur) : 0;
            total += horizontal + vertical;
        }
        return total;
    }

    private RouteResponse toResponse(List<Zone> path) {
        double total = pathLength(path);
        List<RouteStep> steps = new ArrayList<>();
        for (int i = 0; i < path.size(); i++) {
            Zone z = path.get(i);
            Zone prev = i > 0 ? path.get(i - 1) : null;
            steps.add(RouteStep.builder()
                    .zoneId(z.getId())
                    .zoneName(z.getName())
                    .floorNumber(z.getFloor().getNumber())
                    .zoneType(z.getType().name())
                    .instruction(instruction(prev, z, i == 0, i == path.size() - 1))
                    .geometry(GeometryDto.builder()
                            .angleStart(z.getAngleStart())
                            .angleEnd(z.getAngleEnd())
                            .radiusInner(z.getRadiusInner())
                            .radiusOuter(z.getRadiusOuter())
                            .build())
                    .build());
        }
        int seconds = (int) Math.round(total / WALK_SPEED);
        return RouteResponse.builder()
                .totalDistanceMeters(Math.round(total * 10.0) / 10.0)
                .estimatedSeconds(seconds)
                .steps(steps)
                .build();
    }

    private String instruction(Zone prev, Zone current, boolean first, boolean last) {
        if (first) {
            return "Старт: " + current.getName();
        }
        if (prev != null && prev.getFloor().getNumber() != current.getFloor().getNumber()) {
            int to = current.getFloor().getNumber();
            String via = prev.getType() == ZoneType.ELEVATOR ? "на лифте" : "по лестнице";
            String verb = current.getFloor().getNumber() > prev.getFloor().getNumber() ? "Поднимитесь" : "Спуститесь";
            String tail = last ? " — здесь цель: " + current.getName() : "";
            return verb + " на этаж " + to + " " + via + tail;
        }
        if (last) {
            return "Цель: " + current.getName();
        }
        return "Пройдите через «" + current.getName() + "»";
    }
}
