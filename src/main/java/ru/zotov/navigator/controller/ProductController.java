package ru.zotov.navigator.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import ru.zotov.navigator.dto.ProductDto;
import ru.zotov.navigator.service.ProductService;

import java.util.List;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    @GetMapping("/recommendations")
    public List<ProductDto> recommendations(@RequestParam String zoneType) {
        return productService.getRecommendations(zoneType.toUpperCase());
    }
}
