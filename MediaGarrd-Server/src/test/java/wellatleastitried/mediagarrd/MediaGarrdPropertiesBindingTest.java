package wellatleastitried.mediagarrd;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

import java.util.EnumMap;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import wellatleastitried.mediagarrd.Constants.Services;
import wellatleastitried.mediagarrd.services.config.AbstractServiceConfig;
import wellatleastitried.mediagarrd.services.config.CommonServiceConfig;
import wellatleastitried.mediagarrd.services.config.QBittorrentServiceConfig;

@SpringBootTest(properties = {
    "mediagarrd.backup-root=${java.io.tmpdir}/mediagarrd-properties-test",
    "mediagarrd.services.jellyfin.enabled=false",
    "mediagarrd.services.radarr.enabled=false",
    "mediagarrd.services.sonarr.enabled=false",
    "mediagarrd.services.prowlarr.enabled=false",
    "mediagarrd.services.tdarr.enabled=false",
    "mediagarrd.services.qbittorrent.enabled=false"
})
class MediaGarrdPropertiesBindingTest {

    @Autowired
    private MediaGarrdProperties properties;

    @Test
    void bindsConcreteServiceConfigurations() {
        EnumMap<Services, AbstractServiceConfig> configs = properties.getServiceConfigs();

        assertEquals(6, configs.size());
        assertInstanceOf(CommonServiceConfig.class, configs.get(Services.RADARR));
        assertInstanceOf(QBittorrentServiceConfig.class, configs.get(Services.QBITTORRENT));
    }
}
