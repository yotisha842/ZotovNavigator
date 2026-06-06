package ru.zotov.navigator.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

/**
 * Этаж здания Центра «Зотов».
 *
 * <p>Здание круглое, поэтому для рендера достаточно радиуса цилиндра и высоты этажа.</p>
 */
@Entity
@Table(name = "floor")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Floor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Номер этажа (1..5). */
    @Column(nullable = false)
    private int number;

    /** Отображаемое название, например «Первый этаж — Форум». */
    @Column(nullable = false)
    private String name;

    /** Высота этажа в метрах (для 3D). */
    private double heightMeters;

    /** Радиус цилиндра этажа в метрах (для 3D). */
    private double radiusMeters;

    /** Hex-цвет оболочки этажа для рендера. */
    private String color;

    @Column(length = 1000)
    private String description;

    /** Зоны этажа. */
    @OneToMany(mappedBy = "floor")
    @OrderBy("id ASC")
    @Builder.Default
    private List<Zone> zones = new ArrayList<>();
}
