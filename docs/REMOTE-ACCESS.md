# ☁️ Private remote access (Linux server)

RumiStack can keep repositories and project files on one Linux VM while you use its dashboard from more than one laptop. The supported first cloud setup is **private SSH tunnelling**. It does not make RumiStack a public website and does not require a paid reverse-proxy service.

## Why SSH tunnelling

RumiStack is a single-user developer control plane. Its API can clone repositories, install dependencies and run project code. It must not be exposed directly to the public internet.

The Node server deliberately listens on `127.0.0.1` only. SSH encrypts the connection and forwards a port from your laptop to that loopback-only service. The server's firewall does not need an inbound RumiStack port.

## 1. Prepare a Linux VM

Use a Linux VM with persistent disk storage. Install:

- Node.js 20 or newer
- Git
- OpenSSH server

Keep the VM private. Allow SSH only from trusted IP ranges where practical, disable password SSH login after setting up keys, and use a non-root account.

## 2. Clone RumiStack on the VM

For example:

```bash
sudo mkdir -p /opt/rumistack
sudo chown "$USER":"$USER" /opt/rumistack
git clone https://github.com/rumitech-solutions/RumiStack.git /opt/rumistack
cd /opt/rumistack
npm run check
npm test
```

The workspace folders (projects, sources, state, logs and backups) are created locally and remain on the VM's disk. They are not committed to Git.

## 3. Start the private server

```bash
bash scripts/start-linux.sh
```

The script checks Node.js 20+, creates the local workspace folders and starts the app. The server binds to loopback; do not change the application to listen on `0.0.0.0`.

## 4. Connect from a laptop

On Windows PowerShell, macOS Terminal or Linux Terminal, run:

```bash
ssh -N -L 47821:127.0.0.1:47821 <your-user>@<server-public-ip-or-hostname>
```

Keep that terminal open. Then open **http://127.0.0.1:47821** in the laptop browser.

On another laptop, install its own SSH key for the same Linux account and repeat the tunnel command. Do not share private SSH keys between devices.

If port 47821 is already in use locally, forward another local port:

```bash
ssh -N -L 47822:127.0.0.1:47821 <your-user>@<server-public-ip-or-hostname>
```

Then open **http://127.0.0.1:47822**.

## 5. Keep the VM private

- Do not open TCP 47821 in the cloud firewall or Linux firewall.
- Do not put RumiStack behind a public reverse proxy without a separately reviewed authentication and authorization layer.
- Do not expose the Node process using `0.0.0.0`, a public tunnel URL, or unauthenticated port forwarding.
- Use SSH keys, keep the OS patched and restrict SSH access.
- Only import and run repositories you trust. Project dependency installation and launch execute third-party code.
- Keep VM snapshots and independent backups. A VM disk is persistent storage, not a backup.

## Current boundaries

This is a private, single-user remote-workspace path—not multi-user hosting. RumiStack does not yet provide built-in user accounts, role-based access, per-user project isolation, public signup, or a web-based terminal. SSH access is the security boundary.

The server stores project files and runtime state on the VM. GitHub stores the RumiStack source code and any deliberately committed portable configuration; it is not a live sync engine for project working trees.

## Windows remains supported

Keep using `Update-and-Start.bat` on Windows exactly as before. The Linux launcher is an additional deployment path; it does not migrate or overwrite any existing Windows projects or the existing FreeLLMAPI folder.
