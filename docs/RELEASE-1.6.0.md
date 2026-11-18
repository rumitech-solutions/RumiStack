# RumiStack v1.6.0 — Private cloud foundations

## What's included

- Added a Linux launcher for Node.js 20+ servers.
- Kept the application bound to loopback; no public network bind option was added.
- Documented private browser access from Windows, macOS and Linux laptops using SSH local port forwarding.
- Added a per-user systemd service installer with restart-on-failure and basic service hardening.
- Added permission-restricted workspace backup archives with configurable retention.
- Documented Oracle Always Free VM creation, ARM64 Ubuntu setup, SSH-only firewall rules, persistent storage, service management and backup procedures.
- Documented persistent VM workspace storage, SSH hardening and the boundary between a private single-user server and future multi-user hosting.
- Preserved the Windows local launcher and existing project workflow.

## Deployment model

A Linux VM holds the RumiStack checkout, imported repositories, projects, runtime state and logs on its persistent disk. Each laptop connects through an SSH tunnel and opens the dashboard locally in its browser. Port 47821 must remain closed to the public internet.

## Validation

Run `npm run check` and `npm test` on the target VM after cloning. The GitHub Actions matrix should also validate the commit. The Linux launcher itself should be smoke-tested on the chosen VM before relying on it for long-running work.

## Not included

- Built-in browser login or multi-user accounts
- Public internet exposure or public reverse-proxy deployment
- Cloud-provider provisioning or automatic VM creation
- Automatic project synchronization between local and remote machines
- Off-VM backup replication or a managed database
