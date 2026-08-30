package wellatleastitried.mediagarrd.service;

import java.util.ArrayList;
import java.util.List;
import java.util.EnumMap;

import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import wellatleastitried.mediagarrd.Constants;
import wellatleastitried.mediagarrd.services.config.*;
import wellatleastitried.mediagarrd.services.runner.*;

@Component
public class RunnerFactory {

    private static final Logger LOGGER = LoggerFactory.getLogger(RunnerFactory.class);

    public List<Runner> build(EnumMap<Constants.Services, AbstractServiceConfig> serviceConfigMap) {
        List<Runner> runners = new ArrayList<>();

        for (EnumMap.Entry<Constants.Services, AbstractServiceConfig> entry : serviceConfigMap.entrySet()) {
            AbstractServiceConfig config = entry.getValue();
            if (config == null || !config.isEnabled()) {
                LOGGER.debug("Service '{}' is disabled or unconfigured, skipping", entry.getKey());
                continue;
            }

            validate(entry.getKey(), config);

            Constants.Services key = entry.getKey();

            //@ADD_NEW_SERVICE
            @SuppressWarnings("unused")
            Object exhaustive = switch (key) {
                case JELLYFIN -> {
                    runners.add(new JellyfinRunner(config));
                    LOGGER.info("Registered runner: jellyfin");
                    yield null;
                }
                case RADARR -> {
                    runners.add(new RadarrRunner(config));
                    LOGGER.info("Registered runner: radarr");
                    yield null;
                }
                case SONARR -> {
                    runners.add(new SonarrRunner(config));
                    LOGGER.info("Registered runner: sonarr");
                    yield null;
                }
                case PROWLARR -> {
                    runners.add(new ProwlarrRunner(config));
                    LOGGER.info("Registered runner: prowlarr");
                    yield null;
                }
                case TDARR -> {
                    runners.add(new TdarrRunner(config));
                    LOGGER.info("Registered runner: tdarr");
                    yield null;
                }
                case QBITTORRENT -> {
                    runners.add(new QBittorrentRunner((QBittorrentServiceConfig) config));
                    LOGGER.info("Registered runner: qbittorrent");
                    yield null;
                }
                // default -> LOGGER.warn("Unknown service key '{}', no runner registered", Constants.SUPPORTED_SERVICES.get(key));
            };
        }

        LOGGER.info("RunnerFactory built {} runner(s): {}", runners.size(), runners.stream().map(Runner::getServiceName).toList());
        return runners;
    }

    private void validate(Constants.Services key, AbstractServiceConfig config) {
        boolean supported = Constants.SUPPORTED_SERVICES.entrySet()
            .stream()
            .anyMatch(value -> value.getValue().equalsIgnoreCase(Constants.SUPPORTED_SERVICES.get(key)));
        String serviceName = Constants.SUPPORTED_SERVICES.get(key);
        if (!supported) {
            throw new IllegalArgumentException("Unsupported service configured: " + serviceName);
        }

        //@ADD_NEW_SERVICE
        @SuppressWarnings("unused")
        Object exhaustive = switch (key) {
            case JELLYFIN -> {
                requirePath(serviceName, "configPath", config.getConfigPath());
                yield null;
            }
            case RADARR, SONARR, PROWLARR, TDARR -> {
                requirePath(serviceName, "path", config.getPath());
                yield null;
            }
            case QBITTORRENT -> {
                if (!(config instanceof QBittorrentServiceConfig)) {
                    throw new IllegalArgumentException("Invalid configuration for QBittorrent: " + config.getConfigPath());
                }

                QBittorrentServiceConfig qbConfig = (QBittorrentServiceConfig) config;
                requirePath(serviceName, "path", qbConfig.getPath());
                requirePath(serviceName, "graveyardPath", qbConfig.getGraveyardPath());
                yield null;
            }
        };
    }

    private void requirePath(String serviceName, String fieldName, String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Service " + serviceName + " requires " + fieldName);
        }
    }
}
