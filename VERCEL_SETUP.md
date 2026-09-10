# Vercel publish prototype

This branch adds a Vercel-backed authoring workflow while leaving `main` / GitHub Pages untouched.

## Routes

- `/` — student practice app. On Vercel it asks `/api/recording?verse=N` for the newest published boundaries and plays `/api/audio?verse=N`. If no teacher version exists, `/api/audio` redirects to the original GitHub Pages recording.
- `/record-publish/` — teacher recorder. Tap word starts while chanting, tap a word during review to audition only that word, nudge boundaries, then publish.
- `/adjust/` — existing alignment editor.

## Backend

- `POST /api/publish` — authenticated teacher publish. Stores a versioned audio blob plus JSON metadata in Vercel Blob.
- `GET /api/recording?verse=N` — newest published metadata.
- `GET /api/audio?verse=N` — newest published audio, with fallback to the original GitHub Pages audio.

## Vercel configuration

1. Connect a Vercel Blob store to the project. Vercel supplies `BLOB_READ_WRITE_TOKEN`.
2. Add a server-side environment variable named `TEACHER_PUBLISH_KEY` with a strong shared secret for instructors.
3. Deploy with `npm run build`; Vite outputs `dist` and Vercel serves the `api/` functions.

The teacher key is never committed to GitHub. Published blobs are versioned, so future rollback/history can be added without changing the storage model.
