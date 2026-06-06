package ru.zotov.navigator.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ru.zotov.navigator.dto.ChatResponseDto;

import javax.net.ssl.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
public class GigaChatService {

    private static final String TOKEN_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
    private static final String CHAT_URL  = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions";
    private static final String MODEL     = "GigaChat";

    // Ищем маркер {{NAV:{...}}} в конце ответа
    private static final Pattern NAV_PATTERN =
            Pattern.compile("\\{\\{NAV:(\\{[^{}]*\\})\\}\\}", Pattern.DOTALL);

    @Value("${gigachat.auth-token}")
    private String authToken;

    @Value("${gigachat.scope:GIGACHAT_API_PERS}")
    private String scope;

    private final HttpClient   http   = buildTrustAllClient();
    private final ObjectMapper mapper = new ObjectMapper();

    private String  cachedToken;
    private Instant tokenExpiresAt = Instant.EPOCH;

    // ---- public API ---------------------------------------------------

    public ChatResponseDto ask(String userMessage, List<ChatMessage> history) {
        try {
            String token = token();

            ObjectNode body = mapper.createObjectNode();
            body.put("model", MODEL);

            ArrayNode messages = body.putArray("messages");
            addMsg(messages, "system", SYSTEM_PROMPT);

            if (history != null) {
                for (ChatMessage m : history) addMsg(messages, m.role(), m.content());
            }
            addMsg(messages, "user", userMessage);

            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(CHAT_URL))
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();

            HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
            String raw = mapper.readTree(resp.body())
                    .path("choices").get(0).path("message").path("content").asText();

            return parseResponse(raw);

        } catch (Exception e) {
            log.error("GigaChat error", e);
            ChatResponseDto err = new ChatResponseDto();
            err.setReply("Извините, произошла ошибка. Пожалуйста, обратитесь к ресепшену на 1 этаже.");
            return err;
        }
    }

    public record ChatMessage(String role, String content) {}

    // ---- parsing ------------------------------------------------------

    private ChatResponseDto parseResponse(String raw) {
        ChatResponseDto dto = new ChatResponseDto();
        Matcher m = NAV_PATTERN.matcher(raw);

        if (m.find()) {
            dto.setReply(raw.substring(0, m.start()).trim());
            try {
                JsonNode nav = mapper.readTree(m.group(1));
                ChatResponseDto.NavIntent intent = new ChatResponseDto.NavIntent();
                if (nav.has("toId") && !nav.get("toId").isNull())
                    intent.setToId(nav.get("toId").asInt());
                if (nav.has("fromId") && !nav.get("fromId").isNull())
                    intent.setFromId(nav.get("fromId").asInt());
                intent.setNeedFrom(nav.has("needFrom") && nav.get("needFrom").asBoolean());
                dto.setNavIntent(intent);
            } catch (Exception ex) {
                log.warn("NAV marker parse failed: {}", m.group(1));
                dto.setReply(raw.trim()); // fallback: вернуть полный текст
            }
        } else {
            dto.setReply(raw.trim());
        }
        return dto;
    }

    // ---- token --------------------------------------------------------

    private synchronized String token() throws Exception {
        if (cachedToken != null && Instant.now().isBefore(tokenExpiresAt.minusSeconds(60))) {
            return cachedToken;
        }
        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(TOKEN_URL))
                .header("Authorization", "Basic " + authToken)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("RqUID", UUID.randomUUID().toString())
                .POST(HttpRequest.BodyPublishers.ofString("scope=" + scope))
                .build();

        HttpResponse<String> resp = http.send(req, HttpResponse.BodyHandlers.ofString());
        JsonNode json = mapper.readTree(resp.body());
        cachedToken = json.get("access_token").asText();
        long expiresRaw = json.get("expires_at").asLong();
        tokenExpiresAt = (expiresRaw > 1_000_000_000_000L)
                ? Instant.ofEpochMilli(expiresRaw)
                : Instant.ofEpochSecond(expiresRaw);
        log.info("GigaChat token refreshed, expires {}", tokenExpiresAt);
        return cachedToken;
    }

    // ---- helpers ------------------------------------------------------

    private static void addMsg(ArrayNode arr, String role, String content) {
        ObjectNode m = arr.addObject();
        m.put("role", role);
        m.put("content", content);
    }

    private static HttpClient buildTrustAllClient() {
        try {
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, new TrustManager[]{new X509TrustManager() {
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                public void checkClientTrusted(X509Certificate[] c, String a) {}
                public void checkServerTrusted(X509Certificate[] c, String a) {}
            }}, new SecureRandom());
            return HttpClient.newBuilder().sslContext(ctx).build();
        } catch (Exception e) {
            throw new RuntimeException("Cannot init trust-all HttpClient", e);
        }
    }

    // ---- system prompt ------------------------------------------------

    private static final String SYSTEM_PROMPT = """
            Ты — ИИ-ассистент навигатора Центра «Зотов» (Москва, ул. Ходынская, Хлебозавод №5, 1931 г.).
            Отвечай кратко, дружелюбно и по делу. Язык — русский.

            СТРУКТУРА ЗДАНИЯ:
            • 1 этаж   — форум (свободный вход): ресепшен, кассы, кафе, магазин «Зотов.Вещь!», туалеты
            • 1.5 антресоль — гардероб (обязателен для выставок), камеры хранения, туалеты
            • 2 этаж   — выставочные залы A/B/C (основная экспозиция)
            • 2.5 антресоль — детские мастерские А и Б
            • 3 этаж   — выставочные залы D/E
            • 4 этаж   — кинотеатр «Зотов.Кино» (два зала), магазин, лекторий

            Здание круглое — зоны по кольцу. Лифт и лестницы в центре здания.
            Сайт: centrezotov.ru

            КАТАЛОГ ЗОН (используй ID только в маркере {{NAV}}):
            ID=1   Выставочная зона (временные экспозиции) — 1 этаж
            ID=2   Магазин и форум / Кафе / Касса / Ресепшен — 1 этаж
            ID=8   Гардероб (бесплатный, обязателен) — антресоль 1.5
            ID=9   Туалеты — антресоль 1.5
            ID=11  Выставочный зал A/B/C (основная выставка) — 2 этаж
            ID=18  Туалеты — переход 2.5
            ID=20  Выставочный зал D/E — 3 этаж
            ID=26  Кинозал 1 «Зотов.Кино» — 4 этаж
            ID=27  Магазин «Зотов.Вещь!» (книги, дизайн) — 4 этаж
            ID=28  Кинозал 2 / Лекторий — 4 этаж
            ID=36  Детская мастерская А — антресоль 2.5
            ID=37  Детская мастерская Б — антресоль 2.5

            ПРАВИЛО ДЛЯ НАВИГАЦИИ (строго обязательно):
            Если пользователь хочет найти место или попросил построить маршрут к конкретной зоне —
            добавь в конце ответа РОВНО ОДИН маркер в формате:
                {{NAV:{"toId":ID}}}
            Где ID — числовой идентификатор зоны из каталога выше.

            Если пользователь указывает и начальную, и конечную точку — используй:
                {{NAV:{"fromId":ID_ОТКУДА,"toId":ID_КУДА}}}

            Если ты не можешь определить нужную зону — задай уточняющий вопрос и НЕ добавляй маркер {{NAV}}.

            ПРИМЕРЫ:
            Вопрос: «Где кафе?»
            Ответ: Кафе находится на 1 этаже в зоне «Магазин и форум», справа от ресепшена. {{NAV:{"toId":2}}}

            Вопрос: «Как пройти в кинотеатр?»
            Ответ: Кинотеатр «Зотов.Кино» на 4 этаже — два зала. Поднимитесь по лестнице или лифту. {{NAV:{"toId":26}}}

            Вопрос: «Где лекторий?»
            Ответ: Лекторий расположен на 4 этаже в Кинозале 2. {{NAV:{"toId":28}}}

            Вопрос: «Где гардероб?»
            Ответ: Гардероб на антресольном уровне 1.5. После входа подойдите к лестнице и поднимитесь на полэтажа. {{NAV:{"toId":8}}}

            Вопрос: «Как из магазина попасть в кинозал?»
            Ответ: Из магазина на 1 этаже — к лестнице или лифту, подъём до 4 этажа. {{NAV:{"fromId":2,"toId":26}}}
            """;
}
