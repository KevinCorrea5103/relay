# ─── Build stage ───────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS build

WORKDIR /src
COPY go.mod ./
# Pure stdlib — no go.sum to copy. If you ever add deps, copy go.sum + run tidy.
COPY . .

ENV CGO_ENABLED=0 GOOS=linux
RUN go build -ldflags="-s -w" -o /out/relay-runtime ./cmd/runtime

# ─── Runtime stage ─────────────────────────────────────────────────────────
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/relay-runtime /relay-runtime

EXPOSE 4100
ENV PORT=4100

USER nonroot
ENTRYPOINT ["/relay-runtime"]
