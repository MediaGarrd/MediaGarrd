package wellatleastitried.mediagarrd.services.runner;

import java.util.List;

import wellatleastitried.mediagarrd.services.config.*;

import static wellatleastitried.mediagarrd.Constants.*;

public class RadarrRunner extends AbstractLocalCopyRunner {

    private final AbstractServiceConfig config;

    public RadarrRunner(AbstractServiceConfig config) {
        super(SUPPORTED_SERVICES.get(Services.RADARR));
        this.config = config;
    }

    @Override
    protected List<CopySpec> copySpecs() {
        return List.of(dir(config.getPath(), "appdata"));
    }
}
