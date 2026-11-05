package br.edu.t2gcs;

import java.io.IOException;
import java.io.Reader;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Properties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class FlagService {
    private final Path file;

    public FlagService(@Value("${flags.file}") String file) {
        this.file = Path.of(file);
    }

    public record Config(boolean enabled, int percentage, boolean valid) {}
    public record Decision(boolean active, int bucket, String reason, Config config) {}

    // Uma leitura por avaliacao: nao depende de reinicio, cache ou @Value dinamico.
    public Config current() {
        Properties properties = new Properties();
        try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
            properties.load(reader);
            String enabled = properties.getProperty("recommendations.enabled", "").trim();
            if (!enabled.equals("true") && !enabled.equals("false")) return invalid();
            int percentage = Integer.parseInt(properties.getProperty("recommendations.percentage", "").trim());
            if (percentage < 0 || percentage > 100) return invalid();
            return new Config(Boolean.parseBoolean(enabled), percentage, true);
        } catch (IOException | IllegalArgumentException exception) {
            return invalid();
        }
    }

    private Config invalid() {
        // Falha fechada: problema na configuracao preserva a experiencia tradicional.
        return new Config(false, 0, false);
    }

    public Decision evaluate(String userId) {
        Config config = current();
        int bucket = bucket(userId);
        if (!config.valid()) return new Decision(false, bucket, "CONFIG_UNAVAILABLE", config);
        if (!config.enabled()) return new Decision(false, bucket, "DISABLED", config);
        boolean active = bucket < config.percentage();
        return new Decision(active, bucket, active ? "INCLUDED" : "OUTSIDE_ROLLOUT", config);
    }

    public int bucket(String userId) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(("recommendations:" + userId).getBytes(StandardCharsets.UTF_8));
            return (int) (Integer.toUnsignedLong(ByteBuffer.wrap(hash).getInt()) % 100);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 indisponivel", exception);
        }
    }
}
