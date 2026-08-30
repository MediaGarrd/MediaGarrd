package wellatleastitried.mediagarrd.dto;

import java.time.Duration;

public record ScheduleUpdateRequest(Duration backupInterval) {
}
