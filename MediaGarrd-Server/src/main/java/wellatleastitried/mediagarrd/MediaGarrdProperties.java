package wellatleastitried.mediagarrd;

import java.time.Duration;
import java.util.EnumMap;

import org.springframework.boot.context.properties.ConfigurationProperties;

import wellatleastitried.mediagarrd.services.config.AbstractServiceConfig;

@ConfigurationProperties(prefix = "mediagarrd")
public class MediaGarrdProperties {

    private Duration backupInterval = Duration.ofHours(12);
    private String backupRoot = "./data/server/backups";
    private int retentionCount = 10;
    private EnumMap<Constants.Services, AbstractServiceConfig> services = new EnumMap<>(Constants.Services.class);

    public Duration getBackupInterval() {
        return backupInterval;
    }

    public void setBackupInterval(Duration backupInterval) {
        this.backupInterval = backupInterval;
    }

    public String getBackupRoot() {
        return backupRoot;
    }

    public void setBackupRoot(String backupRoot) {
        this.backupRoot = backupRoot;
    }

    public int getRetentionCount() {
        return retentionCount;
    }

    public void setRetentionCount(int retentionCount) {
        this.retentionCount = retentionCount;
    }

    public EnumMap<Constants.Services, AbstractServiceConfig> getServices() {
        return services;
    }

    public void setServices(EnumMap<Constants.Services, AbstractServiceConfig> services) {
        this.services = services;
    }
}
