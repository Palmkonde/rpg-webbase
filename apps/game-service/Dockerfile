# Build from the repo root: docker build -f apps/game-service/Dockerfile .

# Runs on the builder's own architecture and cross-compiles, so a multi-platform build needs no emulation.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.2@sha256:9114c058aeae42162ee16dd5084b95fe9473970bb6bcb5b232ab1630f0546895 AS build
ARG TARGETARCH
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile --filter @codeleagues-rpg-engine/game-service
WORKDIR /repo/apps/game-service
RUN case "$TARGETARCH" in amd64) target=bun-linux-x64 ;; arm64) target=bun-linux-arm64 ;; *) echo "unsupported $TARGETARCH" >&2; exit 1 ;; esac \
 && bun build --compile --minify --target="$target" \
      --no-compile-autoload-dotenv --no-compile-autoload-bunfig \
      --asset drizzle --outfile /out/game-service src/main.ts

FROM gcr.io/distroless/base-nossl-debian13:nonroot@sha256:8c563c1fb5e120606f0d85733049775faed6192e2bd2223ef283a5393eec22b9
COPY --from=build /out/game-service /game-service
USER 65532
EXPOSE 3000
ENTRYPOINT ["/game-service"]
CMD ["serve"]
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 CMD ["/game-service", "health"]
