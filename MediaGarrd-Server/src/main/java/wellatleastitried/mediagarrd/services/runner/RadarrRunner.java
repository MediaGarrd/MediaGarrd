package wellatleastitried.mediagarrd.services.runner;

import java.util.List;

import wellatleastitried.mediagarrd.services.config.*;

public class RadarrRunner extends AbstractLocalCopyRunner {

    private final AbstractServiceConfig config;

    public RadarrRunner(AbstractServiceConfig config) {
        super("Radarr");
        this.config = config;
    }

    @Override
    protected List<CopySpec> copySpecs() {
        return List.of(dir(config.getPath(), "appdata"));
    }
}
