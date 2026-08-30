package wellatleastitried.mediagarrd;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(MediaGarrdProperties.class)
public class MediaGarrd {

    public static void main(String[] args) {
        SpringApplication.run(MediaGarrd.class, args);
    }
}
