package wellatleastitried.mediagarrd.services.config;

public class QBittorrentServiceConfig extends AbstractServiceConfig {

    private String graveyardPath;

    // public QBittorrentServiceConfig(ServiceConfig) {}

    public String getGraveyardPath() {
        return graveyardPath;
    }

    public void setGraveyardPath(String graveyardPath) {
        this.graveyardPath = graveyardPath;
    }
}
