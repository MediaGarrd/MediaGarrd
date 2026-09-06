package wellatleastitried.mediagarrd.services.runner;

import java.util.List;

import wellatleastitried.mediagarrd.services.config.*;

import static wellatleastitried.mediagarrd.Constants.*;

public class JellyfinRunner extends AbstractLocalCopyRunner {

    private final AbstractServiceConfig config;

    public JellyfinRunner(AbstractServiceConfig config) {
        super(SUPPORTED_SERVICES.get(Services.JELLYFIN));
        this.config = config;
    }

    @Override
    protected List<CopySpec> copySpecs() {
        return List.of(dir(config.getConfigPath(), "config"));
    }
}
