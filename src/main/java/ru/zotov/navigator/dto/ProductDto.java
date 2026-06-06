package ru.zotov.navigator.dto;

import ru.zotov.navigator.model.Product;

public record ProductDto(Long id, String name, int price, String shopUrl) {

    public static ProductDto from(Product p) {
        return new ProductDto(p.getId(), p.getName(), p.getPrice(), p.getShopUrl());
    }
}
