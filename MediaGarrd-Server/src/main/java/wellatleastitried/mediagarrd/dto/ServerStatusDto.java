package wellatleastitried.mediagarrd.dto;

import java.time.Duration;

public record ServerStatusDto(
    boolean healthy,
    boolean running,
    int backupRetentionCount,
    Duration backupInterval
) {
}
