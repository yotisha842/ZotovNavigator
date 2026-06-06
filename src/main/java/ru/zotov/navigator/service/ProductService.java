package ru.zotov.navigator.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.zotov.navigator.dto.ProductDto;
import ru.zotov.navigator.repository.ProductRepository;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository repo;

    private static final Map<String, String> ZONE_TAG = Map.of(
            "CINEMA",     "cinema",
            "EXHIBITION", "exhibition",
            "LECTURE",    "lecture",
            "WORKSHOP",   "workshop",
            "CAFE",       "cafe",
            "SHOP",       "shop"
    );

    public List<ProductDto> getRecommendations(String zoneType) {
        String tag = ZONE_TAG.get(zoneType);
        if (tag == null) return List.of();
        return repo.findByTagsContaining(tag).stream()
                .limit(3)
                .map(ProductDto::from)
                .toList();
    }
}
