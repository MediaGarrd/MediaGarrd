package wellatleastitried.mediagarrd.services.runner;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import wellatleastitried.mediagarrd.services.config.*;

import static wellatleastitried.mediagarrd.Constants.*;

public class QBittorrentRunner extends AbstractLocalCopyRunner {

    private final QBittorrentServiceConfig config;

    public QBittorrentRunner(QBittorrentServiceConfig config) {
        super(SUPPORTED_SERVICES.get(Services.QBITTORRENT));
        this.config = config;
    }

    @Override
    protected List<CopySpec> copySpecs() {
        List<CopySpec> specs = new ArrayList<>();
        specs.add(dir(config.getPath(), "appdata"));
        specs.add(dir(config.getGraveyardPath(), "graveyard"));

        Path compose = Path.of(config.getPath()).resolve("docker-compose.yml");
        if (Files.isRegularFile(compose)) {
            specs.add(file(compose.toString(), "docker-compose.yml"));
        }

        return specs;
    }
}
