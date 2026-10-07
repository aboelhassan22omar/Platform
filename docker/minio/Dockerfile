# Public upstream container images are unavailable. Build the official security
# release from pinned source and publish it alongside the application images.
FROM golang:1.24.8-alpine AS builder
RUN apk add --no-cache git ca-certificates
ENV CGO_ENABLED=0
RUN go install github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z

FROM alpine:3.22
RUN apk add --no-cache ca-certificates curl tzdata \
    && addgroup -g 10001 minio && adduser -D -u 10001 -G minio minio \
    && mkdir -p /data && chown minio:minio /data
COPY --from=builder /go/bin/minio /usr/local/bin/minio
USER minio
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
