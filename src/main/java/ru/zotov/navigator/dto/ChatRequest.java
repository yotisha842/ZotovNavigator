package ru.zotov.navigator.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import java.util.List;

@Data
public class ChatRequest {
    @NotBlank
    @Size(max = 500)
    private String message;
    @Size(max = 20)
    private List<@NotNull @Valid ChatMessageDto> history;

    @Data
    public static class ChatMessageDto {
        @NotBlank
        @Pattern(regexp = "user|assistant")
        private String role;
        @NotBlank
        @Size(max = 2000)
        private String content;
    }
}
