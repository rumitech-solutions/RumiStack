# ☁️ Cloud deployment checklist (Oracle Cloud / Ubuntu)

This guide prepares a small, private, single-user RumiStack server. It is not a public web deployment.

## Recommended Always Free target

For a first attempt, use an **Always Free eligible VM.Standard.A1.Flex** shape with Ubuntu ARM64, 2 OCPUs and 12 GB RAM (or a smaller allocation if preferred). Current Oracle documentation lists 1,500 OCPU-hours and 9,000 GB-hours per month for A1, equivalent to 2 OCPUs and 12 GB continuously, plus 200 GB total Always Free block storage and five volume backups. All Always Free compute and block-volume resources must be created in the tenancy's home region. Capacity is not guaranteed; "out of host capacity" is a regional capacity issue, not a RumiStack error.

Official references:
- [Always Free resources and limits](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Oracle Free Tier](https://www.oracle.com/cloud/free/)
- [Create a Linux compute instance](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/launchinginstance.htm)

Choose a home region close to your users when possible (for Pakistan, compare Mumbai and Hyderabad latency if either is offered during signup). **The home region is a tenancy-level decision** and Always Free compute must be created there. Do not create a paid resource to work around capacity errors.

## 1. Create the VM in OCI

In the Oracle Cloud Console:

1. Open **Compute → Instances → Create instance**.
2. Select Ubuntu **ARM64/aarch64** and confirm the image is marked Always Free eligible.
3. Select **VM.Standard.A1.Flex**; start with 2 OCPUs and 12 GB memory if the console confirms both are Always Free eligible.
4. Use a 50 GB boot volume initially. Boot and block volumes share the 200 GB Always Free allowance.
5. Generate or upload an SSH key pair. Download and protect the private key; never upload it to GitHub.
6. Use a public IPv4 address only for SSH reachability. In the VCN security list/NSG, allow inbound TCP 22 only from your current trusted public IP where practical. Do not add port 47821.
7. Create the instance and note its public IP and the default Ubuntu username shown by OCI.

If A1 capacity is unavailable, try another availability domain in the same home region (if offered) or wait and retry. Do not assume that changing to a different region will work: Always Free resources are tied to the home region. A micro AMD VM has only 1 GB RAM and is not the preferred RumiStack host.

## 2. Connect from Windows

In PowerShell, use the private key path and username shown by OCI:

```powershell
ssh -i "$env:USERPROFILE\.ssh\oci_rumistack.key" ubuntu@YOUR_SERVER_IP
```

Use your actual key filename and server IP. On first connection, verify the host fingerprint using OCI's console details before accepting it.

## 3. Install base packages

On Ubuntu:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates openssh-server
```

Install a supported Node.js 20+ ARM64 release using the official Node.js distribution instructions. Confirm:

```bash
node --version
npm --version
git --version
uname -m
```

The architecture should report `aarch64` or `arm64`. Do not assume every third-party coding assistant or binary has an ARM64 build; check compatibility before installing it.

## 4. Install RumiStack

```bash
sudo mkdir -p /opt/rumistack
sudo chown "$USER":"$USER" /opt/rumistack
git clone https://github.com/rumitech-solutions/RumiStack.git /opt/rumistack
cd /opt/rumistack
npm run check
npm test
bash scripts/start-linux.sh
```

Confirm the dashboard responds locally on the server:

```bash
curl -I http://127.0.0.1:47821
```

Stop the foreground process with Ctrl+C before installing the service.

## 5. Install automatic startup

```bash
bash scripts/install-linux-service.sh
```

For a headless server, enable systemd lingering before installing the user services so they can start after SSH logout and reboot:

```bash
sudo loginctl enable-linger "$USER"
```

Check service health and logs:

```bash
systemctl --user status rumistack
journalctl --user -u rumistack -f
```

## 6. Connect from your laptop browser

Keep SSH port 22 reachable only from trusted client IPs where practical. Do not open TCP 47821 in OCI security lists, NSGs or Ubuntu firewall.

From Windows PowerShell:

```powershell
ssh -i "$env:USERPROFILE\.ssh\oci_rumistack.key" -N -L 47821:127.0.0.1:47821 ubuntu@YOUR_SERVER_IP
```

Open **http://127.0.0.1:47821** in your browser. Repeat with a separate SSH key for each laptop. If the local port is busy, use `-L 47822:127.0.0.1:47821` and open `http://127.0.0.1:47822`.

## 7. Backups

Create a local workspace archive:

```bash
cd /opt/rumistack
bash scripts/backup-linux.sh
```

Archives include `sources/`, `projects/`, `state/` and `config/`; large dependency caches such as `node_modules` and Python virtual environments are excluded. Archives are permission-restricted and the default retention is seven backups. Override with `RUMISTACK_BACKUP_RETENTION=14`.

To schedule a daily backup automatically:

```bash
bash scripts/install-linux-backup-timer.sh
systemctl --user list-timers rumistack-backup.timer
```

The timer runs once per day with a small randomized delay and catches up after downtime. The archive remains on the VM until copied elsewhere.

A backup on the same VM is not disaster recovery. Copy archives to a separate trusted location and test restoration before relying on them. Treat backups as private data: repositories and project configuration may contain sensitive material. Do not put backups in a public Git repository.

## 8. Update RumiStack

After a verified release is available:

```bash
cd /opt/rumistack
git status --short
git pull --ff-only origin main
npm run check
npm test
systemctl --user restart rumistack
```

Do not pull over local modifications. Back up workspace data before major upgrades.

## Security and support boundary

- RumiStack binds to loopback only. Never expose port 47821 publicly.
- SSH access is the security boundary for this private single-user installation.
- Use a non-root Linux account, SSH keys, OS updates and restricted SSH ingress.
- Imported repositories and dependency installers execute third-party code; only run trusted projects.
- This setup does not add built-in web login, multi-user accounts, role-based access or project isolation.
- Oracle Always Free has no production SLA and capacity can be constrained. Monitor OCI usage and keep independent backups.
