# TaskNest

An offline-first To-Do Manager Progressive Web App built with **ASP.NET Core 8 Web API**, **EF Core (SQLite)** and **plain HTML/CSS/vanilla JavaScript** — no frontend frameworks.

The backend serves the API and the static frontend from `wwwroot`, so one `dotnet run` starts both.

## Features

- JWT authentication (register, login, `me`) with per-user data isolation
- Tasks with priority, category, due date, notes and subtasks
- Filter by status / category and search
- 25-minute focus timer that logs sessions
- Weekly stats: completed-per-day chart, streak, focus minutes, overdue count
- Offline-first: service worker app shell, IndexedDB cache, queued mutations, optimistic UI
- Background Sync where supported, with the `online` event as fallback
- Due-date reminders while the app is open
- Dark mode, responsive layout, installable PWA

## Requirements

- .NET 8 SDK or newer (the project targets `net8.0`)
- Chrome or Edge for installation and Background Sync support
- Node.js only if you want to run the Lighthouse CLI (the app itself has no npm dependencies)

## Setup

```powershell
cd "C:\Mohd Ali\zaid\.net proj\TaskNest"
dotnet tool restore
dotnet user-secrets set "Jwt:Key" "<at least 32 random characters>"
dotnet run
```

Then open **http://localhost:5299/** and create an account.

- Swagger UI: **http://localhost:5299/swagger** (Development only)
- SQLite database `tasknest.db` is created and migrated automatically on startup.
- If port 5299 is busy: `dotnet run --urls http://localhost:5099`

The JWT signing key is never committed:

- Development: `dotnet user-secrets set "Jwt:Key" "..."` (stored outside the repository)
- Production: set `Jwt__Key` and `ConnectionStrings__DefaultConnection` environment variables

To reset local data: stop the app, delete `tasknest.db`, and run again.

## Folder structure

```
TaskNest/
├─ Controllers/
│  ├─ AuthController.cs        # register, login, me
│  ├─ TasksController.cs       # tasks + subtasks
│  ├─ FocusController.cs       # focus sessions
│  └─ StatsController.cs       # weekly stats
├─ Data/
│  └─ AppDbContext.cs
├─ Dtos/                       # request/response models
├─ Extensions/
│  └─ ClaimsPrincipalExtensions.cs
├─ Migrations/                 # EF Core initial migration
├─ Models/
│  ├─ User.cs
│  ├─ TaskItem.cs
│  ├─ Subtask.cs
│  └─ FocusSession.cs
├─ Services/
│  ├─ IAuthService.cs / AuthService.cs
│  ├─ ITaskService.cs / TaskService.cs
│  ├─ IFocusService.cs / FocusService.cs
│  └─ IStatsService.cs / StatsService.cs
├─ wwwroot/
│  ├─ css/styles.css
│  ├─ icons/                   # 192px and 512px app icons
│  ├─ js/
│  │  ├─ api.js                # fetch wrapper + JWT
│  │  ├─ auth.js               # auth/theme helpers, login/register forms
│  │  ├─ db.js                 # IndexedDB queue + cache
│  │  ├─ theme-init.js         # early theme + route guard
│  │  ├─ app.js                # dashboard, offline queue, reminders, SW
│  │  ├─ focus.js
│  │  └─ stats.js
│  ├─ index.html               # dashboard
│  ├─ login.html
│  ├─ register.html
│  ├─ focus.html
│  ├─ stats.html
│  ├─ offline.html
│  ├─ manifest.json
│  └─ sw.js
├─ Program.cs
├─ appsettings.json
├─ TaskNest.csproj
└─ TaskNest.http               # sample requests
```

## API endpoints

All task, subtask, focus and stats routes require:

```
Authorization: Bearer <jwt>
```

| Method | Route | Description | Success |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Create account, returns JWT | 201 / 400 / 409 |
| POST | `/api/auth/login` | Log in, returns JWT | 200 / 400 / 401 |
| GET | `/api/auth/me` | Current user | 200 |
| GET | `/api/tasks?status=active\|done&category=&q=` | List own tasks | 200 / 400 |
| GET | `/api/tasks/{id}` | Get own task (404 for anyone else's) | 200 / 404 |
| POST | `/api/tasks` | Create task with client Guid; same id = idempotent update | 201 / 200 / 400 / 409 |
| PUT | `/api/tasks/{id}` | Replace task fields | 204 / 400 / 404 |
| PATCH | `/api/tasks/{id}/toggle` | Toggle done, sets `CompletedAt` | 204 / 404 |
| DELETE | `/api/tasks/{id}` | Delete task and cascaded subtasks | 204 / 404 |
| POST | `/api/tasks/{id}/subtasks` | Add subtask (client Guid, idempotent) | 201 / 404 |
| PATCH | `/api/tasks/{id}/subtasks/{subtaskId}` | Update title and/or done state | 204 / 400 / 404 |
| DELETE | `/api/tasks/{id}/subtasks/{subtaskId}` | Delete subtask | 204 / 404 |
| POST | `/api/focus` | Log a focus session (`taskId`, `minutes`, `startedAt`) | 201 / 400 / 404 |
| GET | `/api/stats` | 7-day completions, streak, focus minutes, overdue | 200 |

Other rules: passwords require at least 8 characters, task titles at most 100 characters, and another user's task always returns **404** so its existence is not revealed.

## How offline sync works

1. **Client-generated ids.** Every task and subtask id is a Guid created in the browser. An offline-created task keeps the same id after syncing, so queued follow-up edits still point at the right row.
2. **Two IndexedDB stores** (`wwwroot/js/db.js`):
   - `cache` — the last full task list and last stats response.
   - `queue` — mutations waiting to reach the server, in insertion order.
3. **Optimistic UI.** The dashboard applies a change locally first, saves the local list, renders it, and only then tries the API. If offline or the request fails with a network error, the mutation is added to the queue and the header shows **“N pending changes”**.
4. **Replay.** On page load (when online) and on the `online` event, `flushQueue()` sends queued requests one by one, deletes each on success, and stops at the first failure so order is preserved. It then refreshes from the server.
5. **Background Sync.** When a mutation is queued and `SyncManager` is available, the page registers the `tasknest-sync` tag. The service worker's `sync` handler posts a message to open pages, which flush the queue. If no page is open, the queue flushes on the next visit. Browsers without Background Sync (Safari/Firefox) use the `online` event.
6. **Service worker caching** (`wwwroot/sw.js`):
   - App shell precached on install, old caches removed on activate.
   - Cache-first for static assets.
   - Network-first with cache fallback for `GET /api/tasks` and `GET /api/stats`.
   - `/api/auth/**` is never cached, and non-GET requests are never intercepted.
   - Navigation falls back to the cached shell, then `offline.html`.
7. **Logout** clears the JWT and deletes cached API responses so another account cannot read the previous user's data.

Known limitations: focus sessions are only logged while online (they are not queued), stats days are computed in UTC, and the queue stops on the first permanent failure to protect ordering.

## Reminders

Notification permission is requested **only after a click** on “Enable reminders”. While the dashboard is open, due dates are checked every minute and a notification is shown through the service worker for tasks due within the next hour. Because due dates are dates rather than times, the deadline is treated as the end of the due day.

## Lighthouse

Measured on the authenticated dashboard with Lighthouse 11.7.1 on localhost:

| Category | Score |
| --- | --- |
| Performance | 100 |
| Accessibility | 100 |
| PWA | 100 |

Run it yourself:

1. Log in at http://localhost:5299/index.html.
2. Open Chrome DevTools → **Lighthouse**.
3. Select **Performance**, **Accessibility** and **PWA**, then **Analyze page load**.

Or from the CLI against a Chrome instance that is already logged in:

```powershell
# 1. Start Chrome with remote debugging and log in once.
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\tasknest-lh"

# 2. In another terminal:
npx --yes lighthouse@11.7.1 http://localhost:5299/index.html `
  --port=9222 --only-categories=performance,accessibility,pwa --view
```

Lighthouse 11.x is used because later versions removed the PWA category. Service workers and installation require `localhost` or HTTPS.

## Migrations

```powershell
dotnet tool restore
dotnet dotnet-ef migrations add <MigrationName>
dotnet dotnet-ef database update
```

Migrations also run automatically at startup (`db.Database.Migrate()`), so `dotnet run` is enough for a fresh database.

## Security notes

- Passwords are hashed with `PasswordHasher<User>` (ASP.NET Core Identity's hasher, without installing full Identity).
- JWTs expire after one day and are signed with a key loaded from user-secrets or environment variables.
- Every data query starts from the authenticated user's id from the `sub` claim.
- User text is rendered with `textContent`, never injected as HTML.
- The JWT is stored in `localStorage` as required by the project brief. This is convenient but means XSS would be serious; the frontend avoids HTML injection entirely.
- The CORS policy allows any origin for local development. Restrict it before deploying.
