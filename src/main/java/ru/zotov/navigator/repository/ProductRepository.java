package ru.zotov.navigator.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.zotov.navigator.model.Product;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByTagsContaining(String tag);
}
