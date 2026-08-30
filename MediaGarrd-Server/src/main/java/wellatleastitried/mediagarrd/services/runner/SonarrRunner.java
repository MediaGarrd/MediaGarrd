package wellatleastitried.mediagarrd.services.runner;

import java.util.List;

import wellatleastitried.mediagarrd.services.config.*;

public class SonarrRunner extends AbstractLocalCopyRunner {

    private final AbstractServiceConfig config;

    public SonarrRunner(AbstractServiceConfig config) {
        super("Sonarr");
        this.config = config;
    }

    @Override
    protected List<CopySpec> copySpecs() {
        return List.of(dir(config.getPath(), "appdata"));
    }
}
