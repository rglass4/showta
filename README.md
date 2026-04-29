# MLB The Show 26 Team Affinity Tracker

Static web app for tracking Team Affinity progress with Supabase backend.

## Setup

1. Create a Supabase project.
2. Run SQL in `supabase/schema.sql` and optional `supabase/seed_example.sql`.
3. Copy `config.example.js` to `config.js` and fill values.
4. Serve this repo as static site (GitHub Pages works).

## Local dev

Open `index.html` with a local static server (recommended):

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Troubleshooting login lock message

If you see a message like `Lock "lock:sb-...-auth-token" was released because another request stole it`, it usually means two auth requests overlapped (for example: double-clicking **Log In**, pressing Enter repeatedly, or multiple tabs hitting auth at once). Supabase auth uses a browser lock around the session token; when a newer request takes the lock, the older one logs that warning.

What to do:
- Try logging in once and wait a second.
- Avoid multiple open tabs on the login page while signing in.
- If needed, refresh and try again.

This is typically a transient concurrency warning, not a credential failure by itself.
