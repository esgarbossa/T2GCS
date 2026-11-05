package br.edu.t2gcs;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
public class DemoController {
    private final FlagService flags;
    private final String instanceId = UUID.randomUUID().toString();
    private final Instant startedAt = Instant.now();

    public DemoController(FlagService flags) { this.flags = flags; }

    public record Experience(String userId, String instanceId, Instant startedAt,
            FlagService.Decision flag, String experience, List<String> recommendations) {}

    @GetMapping("/api/experience")
    public ResponseEntity<Experience> experience(@RequestParam String userId) {
        if (userId.isBlank() || userId.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId deve ter de 1 a 100 caracteres");
        }
        FlagService.Decision decision = flags.evaluate(userId);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(new Experience(
                userId, instanceId, startedAt, decision,
                decision.active() ? "COM_RECOMENDACOES" : "TRADICIONAL",
                decision.active() ? List.of("Revisar o artigo", "Ensaiar a apresentacao", "Demonstrar o desligamento") : List.of()));
    }

    @GetMapping("/api/flags")
    public ResponseEntity<Map<String, Object>> config() {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of(
                "flag", "recommendations", "config", flags.current(), "instanceId", instanceId, "startedAt", startedAt));
    }
}
