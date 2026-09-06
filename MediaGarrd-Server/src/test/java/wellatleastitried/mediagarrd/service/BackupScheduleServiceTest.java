package wellatleastitried.mediagarrd.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;

import org.junit.jupiter.api.Test;

import wellatleastitried.mediagarrd.MediaGarrdProperties;

class BackupScheduleServiceTest {

    @Test
    void updatesAndEvaluatesDueState() {
        MediaGarrdProperties props = new MediaGarrdProperties();
        props.setBackupInterval(Duration.ofMillis(1));

        BackupScheduleService service = new BackupScheduleService(props);
        service.updateInterval(Duration.ofMillis(1));

        assertEquals(Duration.ofMillis(1), service.getInterval());
        assertFalse(service.dueNow());

        try {
            Thread.sleep(5);
        } catch (InterruptedException ignored) {
        }

        assertTrue(service.dueNow());
    }
}
