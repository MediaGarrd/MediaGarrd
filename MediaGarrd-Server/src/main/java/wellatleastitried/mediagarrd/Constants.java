package wellatleastitried.mediagarrd;

import java.util.EnumMap;

//@ADD_NEW_SERVICE
public final class Constants {

    public enum Services {
        JELLYFIN,
        RADARR,
        SONARR,
        PROWLARR,
        TDARR,
        QBITTORRENT
    }

    public static final EnumMap<Services, String> SUPPORTED_SERVICES;

    static {
        SUPPORTED_SERVICES = new EnumMap<>(Services.class);
        SUPPORTED_SERVICES.put(Services.JELLYFIN, "Jellyfin");
        SUPPORTED_SERVICES.put(Services.RADARR, "Radarr");
        SUPPORTED_SERVICES.put(Services.SONARR, "Sonarr");
        SUPPORTED_SERVICES.put(Services.PROWLARR, "Prowlarr");
        SUPPORTED_SERVICES.put(Services.TDARR, "Tdarr");
        SUPPORTED_SERVICES.put(Services.QBITTORRENT, "QBittorrent");
    }

    private Constants() {}
}
