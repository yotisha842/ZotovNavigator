package ru.zotov.navigator.dto;

import lombok.Data;

@Data
public class ChatResponseDto {
    private String reply;
    private NavIntent navIntent;

    @Data
    public static class NavIntent {
        private Integer toId;
        private Integer fromId;
        private boolean needFrom;
    }
}
