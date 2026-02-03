# Self-hosted deployment

This fork removes Clerk authentication and ViewComfy Cloud dependencies so
that ViewComfy works fully locally with just a ComfyUI instance. No external
accounts or API keys required. You can deploy it however you like — below is
a reference setup that we use ourselves.

## What changed from upstream

### 1. Optional cloud WebSocket

The original code crashes if `NEXT_PUBLIC_CLOUD_WS_URL` is not set.
In this fork `socket` is exported as `Socket | null` — when the variable is
absent everything works normally, cloud features activate when it is provided.

### 2. Clerk authentication removed

`@clerk/nextjs` is fully removed from dependencies. All imports are replaced
with `lib/clerk-shim.ts` (no-op stubs). The middleware is a simple
pass-through. No Clerk account or API keys needed.

To re-enable Clerk: delete `lib/clerk-shim.ts`, add `@clerk/nextjs` back to
`package.json`, and replace `@/lib/clerk-shim` imports with `@clerk/nextjs`
(search the codebase for `clerk-shim`).

### 3. `.env` removed from git tracking

Each deployment maintains its own `.env` independently — `git pull` will
never overwrite it.

### 4. Dynamic checkpoint selection

New input type `valueType: "checkpoint"` for CheckpointLoader nodes. Instead
of hardcoding model names, the editor fetches available checkpoints from
ComfyUI via `/api/comfy/checkpoints` and displays them in a searchable
dropdown. Users can switch models without editing the workflow JSON.

### 5. User-facing `/app` route

A dedicated route for end users that always loads `view_comfy.json` regardless
of `NEXT_PUBLIC_VIEW_MODE`. This solves the mutual exclusivity problem where
Editor mode (`VIEW_MODE=false`) hides the playground content.

- `/editor` — workflow editor
- `/playground` — preview/testing area
- `/app` — user-facing app (always loads view_comfy.json)

The `/app` route has a simplified sidebar showing only the "App" link. This is
useful when you restrict `/editor` and `/playground` access externally (e.g.
via NGINX auth) — it prevents Next.js prefetch requests to restricted routes.

**Files changed:**
- `app/app/page.tsx` — new route entry point
- `components/pages/app/user-app-page.tsx` — simplified playground without viewMode check
- `app/layout-client.tsx` — sidebar logic for conditional link visibility

### 6. Alphabetical workflow sorting

Workflow dropdown in Playground now sorts workflows alphabetically by name
for easier navigation when you have many workflows configured.

## Minimal .env

```env
COMFY_OUTPUT_DIR="/path/to/ComfyUI/output"
COMFYUI_API_URL="127.0.0.1:8188"
COMFYUI_SECURE="false"

NEXT_PUBLIC_USER_MANAGEMENT="false"
NEXT_PUBLIC_VIEW_COMFY_CLOUD="false"
NEXT_PUBLIC_VIEW_MODE="false"
```

`NEXT_PUBLIC_*` variables are embedded at build time — rebuild after changing
them. Server-side variables take effect after a service restart.

## Fork relationship

| Remote     | URL                                        | Purpose                    |
|------------|--------------------------------------------|----------------------------|
| `origin`   | https://github.com/alru/ViewComfy.git      | This fork (deploy from)    |
| `upstream` | https://github.com/ViewComfy/ViewComfy.git | Original repo (sync from)  |

```bash
git fetch upstream
git merge upstream/main   # resolve conflicts if any
git push origin main
```

---

## Our reference setup

Below is how we run this fork on a dedicated GPU server. You don't have to
follow this exactly — use whatever reverse proxy, auth, and process manager
you prefer.

### Architecture

```
Internet
  |
  +-- :80   -> NGINX (basic auth) -> 127.0.0.1:8188  (ComfyUI)
  +-- :3080 -> NGINX (basic auth) -> 127.0.0.1:3000  (ViewComfy / Next.js)
```

Both ports are protected with NGINX basic auth using the same `.htpasswd`
file. ComfyUI listens only on `127.0.0.1` — it is not exposed directly.

### NGINX

`/etc/nginx/sites-enabled/default`:

```nginx
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    auth_basic "ComfyUI Access";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:8188;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}

server {
    listen 3080;
    server_name _;
    client_max_body_size 100M;

    auth_basic "ViewComfy";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
    }
}
```

Create the password file:

```bash
sudo apt install apache2-utils
sudo htpasswd -c /etc/nginx/.htpasswd youruser   # -c creates the file
sudo nginx -t && sudo systemctl reload nginx
```

### UFW (firewall)

Don't forget to open the ports you need:

```bash
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # ComfyUI via NGINX
sudo ufw allow 3080/tcp   # ViewComfy via NGINX
sudo ufw enable
sudo ufw status
```

### systemd services

`/etc/systemd/system/comfyui.service`:

```ini
[Unit]
Description=ComfyUI
After=network.target

[Service]
Type=simple
User=default
WorkingDirectory=/home/default/apps/ComfyUI
ExecStart=/home/default/apps/ComfyUI/venv/bin/python main.py --listen 127.0.0.1 --port 8188
Restart=on-failure
RestartSec=5
Environment=PATH=/home/default/apps/ComfyUI/venv/bin:/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/viewcomfy.service`:

```ini
[Unit]
Description=ViewComfy
After=network.target

[Service]
Type=simple
User=default
WorkingDirectory=/home/default/apps/viewcomfy
ExecStart=/usr/bin/npm run start
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable comfyui viewcomfy
sudo systemctl start comfyui viewcomfy
```

### Deploying updates

```bash
cd ~/apps/viewcomfy
git pull origin main
npm install
npm run build
sudo systemctl restart viewcomfy
```

### Useful commands

```bash
sudo systemctl status viewcomfy comfyui
sudo journalctl -u viewcomfy -f          # live logs
sudo journalctl -u comfyui -n 50         # last 50 lines
```
