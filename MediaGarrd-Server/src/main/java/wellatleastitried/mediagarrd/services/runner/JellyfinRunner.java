package wellatleastitried.mediagarrd.services.runner;

import wellatleastitried.mediagarrd.services.config.*;

import java.util.List;

public class JellyfinRunner extends AbstractLocalCopyRunner {

    private final AbstractServiceConfig config;

    public JellyfinRunner(AbstractServiceConfig config) {
        super("Jellyfin");
        this.config = config;
    }

    @Override
    protected List<CopySpec> copySpecs() {
        return List.of(dir(config.getConfigPath(), "config"));
    }
}
