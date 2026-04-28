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
