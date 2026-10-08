FROM debian:bookworm-slim@sha256:7c7b2c966bc9ee8cedfeef67e0e279108992c77681fa595db4a9d65c06ccc587
RUN apt-get update && apt-get install -y --no-install-recommends openscap-scanner=1.3.7+dfsg-1+deb12u1 && rm -rf /var/lib/apt/lists/*
WORKDIR /work
