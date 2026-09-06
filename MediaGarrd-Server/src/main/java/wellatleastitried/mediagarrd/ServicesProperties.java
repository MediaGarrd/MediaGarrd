package wellatleastitried.mediagarrd;

import java.util.EnumMap;

import static wellatleastitried.mediagarrd.Constants.*;
import wellatleastitried.mediagarrd.services.config.*;

public class ServicesProperties {

    //@ADD_NEW_SERVICE
    private CommonServiceConfig jellyfin;
    private CommonServiceConfig radarr;
    private CommonServiceConfig sonarr;
    private CommonServiceConfig prowlarr;
    private CommonServiceConfig tdarr;
    private QBittorrentServiceConfig qbittorrent;

    public EnumMap<Services, AbstractServiceConfig> toRuntimeConfigs() {
        EnumMap<Services, AbstractServiceConfig> configs = new EnumMap<>(Services.class);
        put(configs, Services.JELLYFIN, jellyfin);
        put(configs, Services.RADARR, radarr);
        put(configs, Services.SONARR, sonarr);
        put(configs, Services.PROWLARR, prowlarr);
        put(configs, Services.TDARR, tdarr);
        put(configs, Services.QBITTORRENT, qbittorrent);
        return configs;
    }

    private static void put(EnumMap<Services, AbstractServiceConfig> configs, Services service, AbstractServiceConfig config) {
        if (config != null) {
            configs.put(service, config);
        }
    }

    public CommonServiceConfig getJellyfin() {
        return jellyfin;
    }

    public void setJellyfin(CommonServiceConfig jellyfin) {
        this.jellyfin = jellyfin;
    }

    public CommonServiceConfig getRadarr() {
        return radarr;
    }

    public void setRadarr(CommonServiceConfig radarr) {
        this.radarr = radarr;
    }

    public CommonServiceConfig getSonarr() {
        return sonarr;
    }

    public void setSonarr(CommonServiceConfig sonarr) {
        this.sonarr = sonarr;
    }

    public CommonServiceConfig getProwlarr() {
        return prowlarr;
    }

    public void setProwlarr(CommonServiceConfig prowlarr) {
        this.prowlarr = prowlarr;
    }

    public CommonServiceConfig getTdarr() {
        return tdarr;
    }

    public void setTdarr(CommonServiceConfig tdarr) {
        this.tdarr = tdarr;
    }

    public QBittorrentServiceConfig getQbittorrent() {
        return qbittorrent;
    }

    public void setQbittorrent(QBittorrentServiceConfig qbittorrent) {
        this.qbittorrent = qbittorrent;
    }

}
