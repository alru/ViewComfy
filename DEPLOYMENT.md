# Self-hosted deployment notes

This fork (`alru/ViewComfy`) contains modifications for running ViewComfy
on a self-hosted server with a local ComfyUI instance, without ViewComfy Cloud.

## Fork relationship

| Remote     | URL                                        | Purpose                    |
|------------|--------------------------------------------|----------------------------|
| `origin`   | https://github.com/alru/ViewComfy.git      | This fork (deploy from)    |
| `upstream` | https://github.com/ViewComfy/ViewComfy.git | Original repo (sync from)  |

### Syncing with upstream

```bash
git fetch upstream
git merge upstream/main
# resolve conflicts if any, then push
git push origin main
```

## Changes from upstream

### 1. Optional cloud WebSocket (`lib/socket.ts`, `app/providers/socket-provider.tsx`)

**Problem:** The original code throws at module load time if
`NEXT_PUBLIC_CLOUD_WS_URL` is not set. This crashes the Playground page
even in local mode, where the cloud socket is never used.

**Fix:** `socket` is exported as `Socket | null`. When the env variable is
absent, the socket is `null` and all consumers (socket-provider, hooks)
skip initialization gracefully. Cloud functionality still works when the
variable is provided.

### 2. `.env` removed from git tracking (`.gitignore`)

**Problem:** `.env` was tracked by git. Running `git pull` or
`git reset --hard` on the server would overwrite server-specific
configuration (secrets, paths, feature flags).

**Fix:** Added `.env` to `.gitignore` and removed it from tracking.
Each deployment maintains its own `.env` independently.

## Server architecture

```
Internet
  │
  ├── :80   → NGINX (basic auth) → 127.0.0.1:8188  (ComfyUI)
  └── :3080 → NGINX              → 127.0.0.1:3000  (ViewComfy / Next.js)
```

ViewComfy communicates with ComfyUI server-side via `COMFYUI_API_URL`.
External users interact only with ViewComfy through NGINX.

## Server .env configuration

For local-only deployment (no ViewComfy Cloud):

```env
COMFY_OUTPUT_DIR="/path/to/ComfyUI/output"
COMFYUI_API_URL="127.0.0.1:8188"
COMFYUI_SECURE="false"

# Clerk keys are required by middleware even when user management is off
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."

# Disable cloud and user management
NEXT_PUBLIC_USER_MANAGEMENT="false"
NEXT_PUBLIC_VIEW_COMFY_CLOUD="false"
NEXT_PUBLIC_VIEW_MODE="false"

# Cloud settings — commented out, not needed for local deployment
#NEXT_PUBLIC_CLOUD_WS_URL="http://localhost:8000"
#NEXT_PUBLIC_API_URL="http://your-server:3080"
#NEXT_PUBLIC_CLERK_SIGN_IN_URL="/login"
#NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL="/"
#NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL="/"
```

### Why Clerk keys are still needed

The `middleware.ts` imports `clerkMiddleware` unconditionally. Even with
`NEXT_PUBLIC_USER_MANAGEMENT="false"` (which makes the middleware pass all
requests through), Clerk requires valid keys at initialization. Without them
every route returns 500.

## Deploying updates

On the server:

```bash
cd ~/apps/viewcomfy
git pull origin main
npm run build          # required for any NEXT_PUBLIC_* changes
sudo systemctl restart viewcomfy
```

Note: `NEXT_PUBLIC_*` variables are embedded at build time. Server-side
variables (without the prefix) take effect after a service restart only.

## Server management

```bash
sudo systemctl status viewcomfy
sudo systemctl restart viewcomfy
sudo journalctl -u viewcomfy -f          # live logs
sudo journalctl -u viewcomfy -n 50       # last 50 lines
```
