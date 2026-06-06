package ru.zotov.navigator.dto;

import lombok.Data;
import java.util.List;

@Data
public class ChatRequest {
    private String message;
    private List<ChatMessageDto> history;

    @Data
    public static class ChatMessageDto {
        private String role;
        private String content;
    }
}
