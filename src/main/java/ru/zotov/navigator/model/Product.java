package ru.zotov.navigator.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "product")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    private int price;

    @Column(nullable = false)
    private String shopUrl;

    /** Теги через запятую: "cinema", "exhibition", "lecture", "workshop", "cafe", "shop". */
    @Column(nullable = false)
    private String tags;
}
