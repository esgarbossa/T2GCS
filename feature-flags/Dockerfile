FROM maven:3.9.16-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml ./
COPY src ./src
RUN mvn -B verify

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /build/target/feature-flags-1.0.0.jar app.jar
COPY config ./config
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
