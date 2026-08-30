package wellatleastitried.mediagarrd.services.runner;

import java.util.List;

import wellatleastitried.mediagarrd.services.config.*;

public class TdarrRunner extends AbstractLocalCopyRunner {

    private final AbstractServiceConfig config;

    public TdarrRunner(AbstractServiceConfig config) {
        super("Tdarr");
        this.config = config;
    }

    @Override
    protected List<CopySpec> copySpecs() {
        return List.of(dir(config.getPath(), "appdata"));
    }
}
