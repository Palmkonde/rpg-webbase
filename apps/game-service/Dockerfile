# Build from the repo root: docker build -f apps/game-service/Dockerfile .

# Runs on the builder's own architecture and cross-compiles, so a multi-platform build needs no emulation.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.4@sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d AS build
ARG TARGETARCH
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile --filter @codeleagues-rpg-engine/game-service
WORKDIR /repo/apps/game-service
RUN case "$TARGETARCH" in amd64) target=bun-linux-x64 ;; arm64) target=bun-linux-arm64 ;; *) echo "unsupported $TARGETARCH" >&2; exit 1 ;; esac \
 && bun build --compile --minify --target="$target" \
      --no-compile-autoload-dotenv --no-compile-autoload-bunfig \
      --asset drizzle --outfile /out/game-service src/main.ts

FROM gcr.io/distroless/base-nossl-debian13:nonroot@sha256:83df5862465415c1d5f3ade85adc4d58a922db94e0b4d26c83a1bf96d5adf72d
COPY --from=build /out/game-service /game-service
USER 65532
EXPOSE 3000
ENTRYPOINT ["/game-service"]
CMD ["serve"]
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 CMD ["/game-service", "health"]
