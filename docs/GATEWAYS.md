# Gateways in Docker

The **Gateways (Docker)** view starts and stops self-hosted gateways (FreeLLMAPI, OmniRoute) using **their own upstream `docker-compose.yml`**. RumiStack does not ship or edit compose files, so you always run what the upstream project documents.

## Requirements

- Docker Desktop (`winget install --id Docker.DockerDesktop --exact`), started, with the compose plugin.
- The gateway cloned into `sources/<id>` (Catalogue → *Clone source*, or apply the *Free-tier gateway* kit).

## Flow

1. **Prepare .env** copies the upstream `.env.example` to `.env` (never overwrites an existing one). For FreeLLMAPI a random `ENCRYPTION_KEY` is generated locally; it is never returned to the browser or written to the activity log. **Review the file before starting.**
2. **Start** runs `docker compose up -d` (OmniRoute: `--profile base`). The first start downloads or builds images and can take several minutes.
3. **Stop** runs `docker compose down`. Volumes are never removed, so gateway data survives.
4. **Logs** shows the last 150 lines (capped at 64 KB).
5. Add the gateway under Provider manager and use **Test connection**. Its API key lives in an environment variable on your laptop, never in the profile.

## Safety rules

- Only registry entries with a `docker` block can be controlled; the browser sends a tool id and nothing else.
- Fixed arguments only. No `-v`/`--volumes`, no `cli` profile (it mounts the Docker socket) and no Watchtower auto-update profile.
- The dashboard warns when `.env` publishes a gateway beyond `127.0.0.1` (`HOST_BIND` / `APP_BIND_HOST`).
- `.env` files live in `sources/` and are git-ignored; they are not part of the portable profile.

## Not verified

The compose layouts were read from the upstream repositories on 2026-11-04 and the flow was tested against a fake `docker` executable. It has **not** been run against a real Docker engine or the real images. Upstream may change file names, profiles or required `.env` values; if a start fails, open Logs and check the upstream README.
