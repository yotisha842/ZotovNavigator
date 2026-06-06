package ru.zotov.navigator.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import ru.zotov.navigator.dto.ChatRequest;
import ru.zotov.navigator.dto.ChatResponseDto;
import ru.zotov.navigator.service.GigaChatService;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatController {

    private final GigaChatService gigaChat;

    @PostMapping
    public ChatResponseDto chat(@RequestBody ChatRequest req) {
        List<GigaChatService.ChatMessage> history = null;
        if (req.getHistory() != null) {
            history = req.getHistory().stream()
                    .map(m -> new GigaChatService.ChatMessage(m.getRole(), m.getContent()))
                    .toList();
        }
        return gigaChat.ask(req.getMessage(), history);
    }
}
