package wellatleastitried.mediagarrd.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import wellatleastitried.mediagarrd.Constants.Services;
import wellatleastitried.mediagarrd.services.config.AbstractServiceConfig;
import wellatleastitried.mediagarrd.services.config.CommonServiceConfig;
import wellatleastitried.mediagarrd.services.config.QBittorrentServiceConfig;
import wellatleastitried.mediagarrd.services.runner.Runner;

@Tag("real-runners")
class RunnersIntegrationTest {

    @TempDir
    Path tempDir;

    @Test
    void enabledRunnersCopyFilesFromConfiguredPaths() throws Exception {
        Map<String, String> env = loadEnv();

        EnumMap<Services, AbstractServiceConfig> configs = new EnumMap<>(Services.class);

        addJellyfin(configs, env);
        addPathService(configs, env, Services.RADARR);
        addPathService(configs, env, Services.SONARR);
        addPathService(configs, env, Services.PROWLARR);
        addPathService(configs, env, Services.TDARR);
        addQbittorrent(configs, env);

        RunnerFactory factory = new RunnerFactory();
        List<Runner> runners = factory.build(configs);
        assertFalse(runners.isEmpty(), "No runners enabled in .env/.env.test.");

        Path outputDirectory = tempDir.resolve("runner-output");
        Files.createDirectories(outputDirectory);

        for (Runner runner : runners) {
            runner.run(outputDirectory);
        }

        assertEquals(configs.size(), runners.size());
        for (Runner runner : runners) {
            Path serviceOutput = outputDirectory.resolve(runner.getServiceName().toLowerCase(Locale.ROOT));
            assertTrue(Files.exists(serviceOutput), "Missing service output directory: " + serviceOutput);

            try (var walk = Files.walk(serviceOutput)) {
                assertTrue(
                    walk.anyMatch(Files::isRegularFile),
                    "No files copied for service " + runner.getServiceName()
                );
            }
        }
    }

    private void addJellyfin(EnumMap<Services, AbstractServiceConfig> configs, Map<String, String> env) {
        boolean enabled = booleanValue(env, "JELLYFIN_ENABLED", "jellyfin_enabled", false);
        if (!enabled) {
            return;
        }

        CommonServiceConfig config = new CommonServiceConfig();
        config.setEnabled(true);
        config.setConfigPath(required(env, "JELLYFIN_CONFIG_PATH", "jellyfin_config_path"));

        configs.put(Services.JELLYFIN, config);
    }

    private void addQbittorrent(EnumMap<Services, AbstractServiceConfig> configs, Map<String, String> env) {
        boolean enabled = booleanValue(env, "QBITTORRENT_ENABLED", "qbittorrent_enabled", false);
        if (!enabled) {
            return;
        }

        QBittorrentServiceConfig config = new QBittorrentServiceConfig();
        config.setEnabled(true);
        config.setPath(required(env, "QBITTORRENT_PATH", "qbittorrent_path"));
        config.setGraveyardPath(required(env, "QBITTORRENT_GRAVEYARD_PATH", "qbittorrent_graveyard_path"));

        configs.put(Services.QBITTORRENT, config);
    }

    private void addPathService(
        EnumMap<Services, AbstractServiceConfig> configs,
        Map<String, String> env,
        Services service
    ) {
        String key = service.name().toLowerCase(Locale.ROOT);
        String upper = service.name();
        boolean enabled = booleanValue(env, upper + "_ENABLED", key + "_enabled", false);
        if (!enabled) {
            return;
        }

        CommonServiceConfig config = new CommonServiceConfig();
        config.setEnabled(true);
        config.setPath(required(env, upper + "_PATH", key + "_path"));

        configs.put(service, config);
    }

    private Map<String, String> loadEnv() throws IOException {
        Map<String, String> merged = new HashMap<>();
        merged.putAll(parseDotEnv(resolveEnvFile()));
        merged.putAll(System.getenv());
        return merged;
    }

    private Path resolveEnvFile() {
        String override = System.getenv("MEDIAGARRD_TEST_ENV_FILE");
        if (override != null && !override.isBlank()) {
            Path explicit = Path.of(override).toAbsolutePath().normalize();
            if (Files.exists(explicit)) {
                return explicit;
            }
            throw new IllegalStateException("MEDIAGARRD_TEST_ENV_FILE not found: " + explicit);
        }

        Path current = Path.of("").toAbsolutePath();
        for (int i = 0; i < 8 && current != null; i++) {
            Path testEnv = current.resolve(".env.test");
            if (Files.exists(testEnv)) {
                return testEnv;
            }
            Path prodEnv = current.resolve(".env");
            if (Files.exists(prodEnv)) {
                return prodEnv;
            }
            current = current.getParent();
        }

        throw new IllegalStateException("No .env.test or .env found. Create one from .env.test.example or .env.example.");
    }

    private Map<String, String> parseDotEnv(Path file) throws IOException {
        Map<String, String> values = new HashMap<>();
        List<String> lines = Files.readAllLines(file);
        for (String rawLine : lines) {
            if (rawLine == null) {
                continue;
            }
            String line = rawLine.trim();
            if (line.isBlank() || line.startsWith("#")) {
                continue;
            }
            int idx = line.indexOf('=');
            if (idx <= 0) {
                continue;
            }
            String key = line.substring(0, idx).trim();
            String value = line.substring(idx + 1).trim();
            if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length() - 1);
            }
            values.put(key, value);
        }
        return values;
    }

    private String required(Map<String, String> env, String... keys) {
        String value = firstPresent(env, keys);
        if (value == null || value.isBlank()) {
            throw new IllegalStateException("Missing required .env key. Expected one of: " + String.join(", ", keys));
        }
        return value;
    }

    private boolean booleanValue(Map<String, String> env, String keyUpper, String keyLower, boolean fallback) {
        String value = firstPresent(env, keyUpper, keyLower);
        if (value == null || value.isBlank()) {
            return fallback;
        }
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        return normalized.equals("1") || normalized.equals("true") || normalized.equals("yes") || normalized.equals("y") || normalized.equals("on");
    }

    private String firstPresent(Map<String, String> env, String... keys) {
        for (String key : keys) {
            String value = env.get(key);
            if (value != null) {
                return value;
            }
        }
        return null;
    }

}
