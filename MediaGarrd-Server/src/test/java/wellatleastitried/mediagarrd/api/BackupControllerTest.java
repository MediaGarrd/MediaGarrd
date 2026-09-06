package wellatleastitried.mediagarrd.api;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import wellatleastitried.mediagarrd.MediaGarrdProperties;
import wellatleastitried.mediagarrd.model.BackupArchive;
import wellatleastitried.mediagarrd.model.BackupRunResult;
import wellatleastitried.mediagarrd.service.BackupArchiveService;
import wellatleastitried.mediagarrd.service.BackupOrchestratorService;

@WebMvcTest(BackupController.class)
class BackupControllerTest {
    @Autowired
    MockMvc mockMvc;

    @MockBean
    BackupArchiveService archiveService;

    @MockBean
    BackupOrchestratorService orchestratorService;

    @MockBean
    MediaGarrdProperties properties;

    @Test
    void healthReturnsServerStatus() throws Exception {
        when(orchestratorService.isRunning()).thenReturn(false);
        when(orchestratorService.getInterval()).thenReturn(Duration.ofHours(12));
        when(properties.getRetentionCount()).thenReturn(10);

        mockMvc.perform(get("/api/v1/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.healthy").value(true));
    }

    @Test
    void runAndListBackups() throws Exception {
        BackupArchive archive = new BackupArchive(
            "backup-1",
            "backup-1.zip",
            Path.of("backup-1.zip"),
            12,
            Instant.parse("2026-01-01T00:00:00Z")
        );
        BackupRunResult result = new BackupRunResult(
            "run-1",
            Instant.parse("2026-01-01T00:00:00Z"),
            Instant.parse("2026-01-01T00:01:00Z"),
            List.of(),
            archive
        );
        when(orchestratorService.runBackup()).thenReturn(result);
        when(archiveService.listArchives()).thenReturn(List.of(archive));

        mockMvc.perform(post("/api/v1/backups/run"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.archive.id").isNotEmpty());

        mockMvc.perform(get("/api/v1/backups"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)));
    }
}
