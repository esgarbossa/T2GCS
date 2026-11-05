package br.edu.t2gcs;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import static org.junit.jupiter.api.Assertions.*;

class FlagServiceTest {
    @TempDir Path directory;

    private FlagService configure(String content) throws Exception {
        Path file = directory.resolve("flags.properties");
        Files.writeString(file, content);
        return new FlagService(file.toString());
    }

    private void update(boolean enabled, int percentage) throws Exception {
        configure("recommendations.enabled=" + enabled + "\nrecommendations.percentage=" + percentage);
    }

    @Test void reloadAndKillSwitchWithoutRecreatingService() throws Exception {
        FlagService service = configure("recommendations.enabled=false\nrecommendations.percentage=100");
        assertFalse(service.evaluate("ana").active());
        update(true, 100);
        assertTrue(service.evaluate("ana").active());
        update(false, 100);
        assertFalse(service.evaluate("ana").active());
        assertEquals("DISABLED", service.evaluate("ana").reason());
    }

    @Test void zeroAndHundredPercent() throws Exception {
        FlagService service = configure("recommendations.enabled=true\nrecommendations.percentage=0");
        for (int i = 0; i < 1000; i++) assertFalse(service.evaluate("user-" + i).active());
        update(true, 100);
        for (int i = 0; i < 1000; i++) assertTrue(service.evaluate("user-" + i).active());
    }

    @Test void rolloutIsStableAndGrowing() throws Exception {
        FlagService service = configure("recommendations.enabled=true\nrecommendations.percentage=10");
        Set<String> first = new HashSet<>();
        Set<String> second = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            String user = "user-" + i;
            var decision = service.evaluate(user);
            assertEquals(decision, service.evaluate(user));
            assertTrue(decision.bucket() >= 0 && decision.bucket() < 100);
            if (decision.active()) first.add(user);
        }
        update(true, 50);
        for (int i = 0; i < 1000; i++) if (service.evaluate("user-" + i).active()) second.add("user-" + i);
        assertTrue(first.size() > 50 && first.size() < 150);
        assertTrue(second.size() > 400 && second.size() < 600);
        assertTrue(second.containsAll(first));
    }

    @Test void invalidOrMissingConfigurationDisablesFeature() throws Exception {
        for (String value : new String[] { "", "recommendations.enabled=maybe\nrecommendations.percentage=10",
                "recommendations.enabled=true\nrecommendations.percentage=101", "recommendations.enabled=true\nrecommendations.percentage=-1",
                "recommendations.enabled=true\nrecommendations.percentage=text" }) {
            FlagService service = configure(value);
            assertFalse(service.evaluate("ana").active());
            assertEquals("CONFIG_UNAVAILABLE", service.evaluate("ana").reason());
        }
        FlagService service = new FlagService(directory.resolve("missing").toString());
        assertFalse(service.current().valid());
    }

    @Test void controllerChangesRealResponseAndKeepsInstance() throws Exception {
        FlagService service = configure("recommendations.enabled=false\nrecommendations.percentage=100");
        DemoController controller = new DemoController(service);
        var before = controller.experience("ana").getBody();
        update(true, 100);
        var after = controller.experience("ana").getBody();
        assertEquals(before.instanceId(), after.instanceId());
        assertEquals(before.startedAt(), after.startedAt());
        assertTrue(before.recommendations().isEmpty());
        assertEquals(3, after.recommendations().size());
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> controller.experience(" "));
    }
}
