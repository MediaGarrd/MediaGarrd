FROM gradle:9.4.0-jdk21 AS build
WORKDIR /workspace
COPY . .
RUN --mount=type=cache,target=/home/gradle/.gradle \
    gradle :MediaGarrd-Server:bootJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/MediaGarrd-Server/build/libs/*.jar app.jar
EXPOSE 8080

ENTRYPOINT ["java", \
  "-Xms32m", \
  "-XX:+UseZGC", \
  "-XX:+ZUncommit", \
  "-XX:ZUncommitDelay=30", \
  "-XX:+UseContainerSupport", \
  "-Dspring.main.lazy-initialization=true", \
  "-jar", "/app/app.jar"]
