package ru.zotov.navigator.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Пространство (зона) на этаже.
 *
 * <p>Так как здание круглое, геометрия зоны описана сектором кольца:
 * угловой диапазон [{@code angleStart}, {@code angleEnd}] в градусах и
 * радиальный диапазон [{@code radiusInner}, {@code radiusOuter}] в метрах.
 * Это удобно и для рендера ({@code RingGeometry}), и для построения графа маршрутов.</p>
 */
@Entity
@Table(name = "zone")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Zone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ZoneType type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;

    /** Начальный угол сектора, градусы [0..360). */
    private double angleStart;

    /** Конечный угол сектора, градусы (0..360]. */
    private double angleEnd;

    /** Внутренний радиус сектора, метры. */
    private double radiusInner;

    /** Внешний радиус сектора, метры. */
    private double radiusOuter;

    private String color;

    @Column(length = 1000)
    private String description;

    /** Ключ иконки в UI. */
    private String iconKey;

    /** Средний угол сектора в градусах — центр зоны по углу. */
    public double centerAngle() {
        return (angleStart + angleEnd) / 2.0;
    }

    /** Средний радиус сектора в метрах — центр зоны по радиусу. */
    public double centerRadius() {
        return (radiusInner + radiusOuter) / 2.0;
    }
}
