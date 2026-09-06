package wellatleastitried.mediagarrd.service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;

import wellatleastitried.mediagarrd.Constants.Services;
import wellatleastitried.mediagarrd.services.config.AbstractServiceConfig;
import wellatleastitried.mediagarrd.services.config.CommonServiceConfig;
import wellatleastitried.mediagarrd.services.config.QBittorrentServiceConfig;
import wellatleastitried.mediagarrd.services.runner.Runner;

public final class RealRunnersInteractiveCheck {

    private RealRunnersInteractiveCheck() {
    }

    public static void main(String[] args) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));

        System.out.println("=== Real Runner Integration Check ===");
        System.out.println("This check prompts for local directory/file paths on the server host.");
        System.out.println("Any service you skip will not be run.");

        EnumMap<Services, AbstractServiceConfig> configs = new EnumMap<>(Services.class);
        configs.put(Services.JELLYFIN, promptJellyfin(reader));
        configs.put(Services.RADARR, promptPathService(reader, "Radarr"));
        configs.put(Services.SONARR, promptPathService(reader, "Sonarr"));
        configs.put(Services.PROWLARR, promptPathService(reader, "Prowlarr"));
        configs.put(Services.TDARR, promptPathService(reader, "Tdarr"));
        configs.put(Services.QBITTORRENT, promptQbittorrent(reader));

        RunnerFactory factory = new RunnerFactory();
        List<Runner> runners = factory.build(configs);
        if (runners.isEmpty()) {
            throw new IllegalStateException("No runners enabled. Re-run and enable at least one service.");
        }

        Path output = Files.createTempDirectory("real-runner-output-");

        System.out.println("Running " + runners.size() + " runners...");
        for (Runner runner : runners) {
            System.out.println("- Running: " + runner.getServiceName());
            runner.run(output);
        }

        long fileCount;
        try (var walk = Files.walk(output)) {
            fileCount = walk.filter(Files::isRegularFile).count();
        }

        if (fileCount <= 0) {
            throw new IllegalStateException("No files were discovered/written by enabled runners.");
        }

        System.out.println("Runner output directory: " + output);
        System.out.println("Total files discovered: " + fileCount);
    }

    private static AbstractServiceConfig promptJellyfin(BufferedReader reader) throws Exception {
        CommonServiceConfig config = new CommonServiceConfig();
        boolean enabled = askYesNo(reader, "Enable Jellyfin runner? [y/N]: ", false);
        config.setEnabled(enabled);
        if (!enabled) {
            return config;
        }

        config.setConfigPath(ask(reader, "Jellyfin config directory", "/mnt/appdata/jellyfin/config"));
        return config;
    }

    private static AbstractServiceConfig promptPathService(BufferedReader reader, String label) throws Exception {
        CommonServiceConfig config = new CommonServiceConfig();
        boolean enabled = askYesNo(reader, "Enable " + label + " runner? [y/N]: ", false);
        config.setEnabled(enabled);
        if (!enabled) {
            return config;
        }

        String lower = label.toLowerCase(Locale.ROOT);
        config.setPath(ask(reader, label + " base directory", "/mnt/appdata/" + lower));
        return config;
    }

    private static AbstractServiceConfig promptQbittorrent(BufferedReader reader) throws Exception {
        QBittorrentServiceConfig config = new QBittorrentServiceConfig();
        boolean enabled = askYesNo(reader, "Enable qBittorrent runner? [y/N]: ", false);
        config.setEnabled(enabled);
        if (!enabled) {
            return config;
        }

        config.setPath(ask(reader, "qBittorrent base directory", "/mnt/appdata/qbittorrent"));
        config.setGraveyardPath(ask(reader, "qBittorrent graveyard directory", "/mnt/media/graveyard"));
        return config;
    }

    private static String ask(BufferedReader reader, String prompt, String defaultValue) throws Exception {
        System.out.print(prompt + (defaultValue == null || defaultValue.isBlank() ? ": " : " [" + defaultValue + "]: "));
        String line = reader.readLine();
        if (line == null) {
            return defaultValue == null ? "" : defaultValue;
        }
        String trimmed = line.trim();
        if (trimmed.isEmpty()) {
            return defaultValue == null ? "" : defaultValue;
        }
        return trimmed;
    }

    private static boolean askYesNo(BufferedReader reader, String prompt, boolean defaultValue) throws Exception {
        String fallback = defaultValue ? "y" : "n";
        String answer = ask(reader, prompt, fallback).toLowerCase(Locale.ROOT);
        return answer.equals("y") || answer.equals("yes") || answer.equals("true");
    }
}
