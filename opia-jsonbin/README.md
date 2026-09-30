# OPIA: GitHub + JSONBin backend

The p5 site stays on GitHub Pages. A small Node backend reads and writes a private JSONBin. The JSONBin secret never enters public browser code.

The hosted ChatGPT version has its own database. This package is specifically for your GitHub/JSONBin class version. It is prepared and tested, but is not connected to your personal JSONBin account until you configure the values below.

## 1. Create your bin

Sign in at https://jsonbin.io and create a PRIVATE bin containing:

```json
{"stars": []}
```

Name it `OPIA Galaxy`. Copy its bin ID. In API Keys, create an access key with Read and Update permission for this bin. Keep that key secret.

Do not make the bin public: it contains ownership hashes and private demographic responses as well as the public statements. The backend returns only the public fields to visitors.

## 2. Put the project in GitHub

Upload the CONTENTS of this folder to your repository root. Keep `public` as a folder. Include `.github/workflows/pages.yml`, which publishes only the `public` folder.

In GitHub → Settings → Pages, set Source to GitHub Actions. The workflow assumes the branch is `main`; change the branch in `pages.yml` if yours is different.

Do not upload a real `.env`, the `storage` folder, or your JSONBin secret.

## 3. Host the backend

GitHub Pages only hosts the frontend. The backend needs a Node web-service host.

One option is Render: https://render.com/docs/deploy-node-express-app

Create a Node Web Service connected to the same repository and use:

- Build command: `npm install`
- Start command: `npm start`
- Node version: 22 or newer

Add these SERVER environment variables through the host's dashboard:

| Name | Value |
| --- | --- |
| `JSONBIN_BIN_ID` | `6abc8ad2ac6210605a0410f9` |
| `JSONBIN_ACCESS_KEY` | Your secret access key |
| `OPIA_ALLOWED_ORIGIN` | `https://instinctpros.github.io` |

Do not put `/Week3_opia_dataset/` into the allowed origin. An origin includes the domain only.

Run one backend instance for this class prototype. JSONBin replaces the entire JSON document on update; the backend queues saves to avoid overwriting simultaneous submissions within that instance. Multiple backend replicas or manual editing of the bin during saves could overwrite changes. A database is the later upgrade for larger use.

## 4. Connect your p5 frontend

Open `public/config.js` and set the HTTPS address returned by your backend host:

```javascript
window.OPIA_API_BASE = 'YOUR_BACKEND_HTTPS_ORIGIN';
```

Use the real address, without a final slash. This is a public URL, not a secret key.

Commit the change. GitHub Actions republishes the p5 frontend.

## 5. Test with two browsers

1. Open your GitHub Pages site and create a star.
2. Refresh and confirm Return to my galaxy can still find it.
3. Open another browser or private window and create another star.
4. Confirm both stars appear, then leave a reply and click This resonates.
5. Refresh again to confirm the response stayed.
6. Look at your JSONBin record: it should now contain the saved stars and replies.

The server refreshes its copy periodically and the galaxy checks once a minute to keep JSONBin request use modest. Reload for a quicker class demonstration after someone adds a star.

## Local setup first

Install Node 22 or newer. Copy `.env.example` to `.env`, put your bin ID and key into the local `.env`, then run:

```sh
npm start
```

Open http://localhost:3000. No dependency installation is required for the server. If both JSONBin variables are blank, the server explicitly uses `storage/galaxy.json` for local testing. If only one is configured, or the bin/key is invalid, startup fails instead of silently pretending to save to JSONBin.

## How it works, in plain language

- p5 draws your sky and galaxy.
- `galaxy.js` calls your API using `fetch()`.
- `config.js` tells it where the API lives.
- `server.mjs` validates submissions, checks ownership, and coordinates saving.
- `storage.mjs` calls JSONBin's GET and PUT endpoints with the private access key.
- JSONBin holds the permanent record of stars, replies, and reactions.
- A browser stores a random visitor token only. The backend stores its hash. The token lets someone return without a password; the stars and statements themselves are not stored in localStorage.

Public star fields are nickname, city, country, galaxy age group, feeling, and statement. Other demographic answers are kept private by the API. Clearing browser storage or using a different device loses ownership access; login/recovery can come later.

## API routes

| Route | What it does |
| --- | --- |
| `GET /api/stars` | Load shared stars and find this visitor's star |
| `POST /api/stars` | Create or update this visitor's star |
| `POST /api/stars/:id/replies` | Save a short reply |
| `POST /api/stars/:id/resonate` | Record one reaction per visitor |
| `DELETE /api/stars/:id` | Remove only this visitor's own star |

## Limits

This is a small cohort prototype with a single shared bin. The adapter refuses large records before they exceed the free-bin size allowance. JSONBin request limits also depend on your account. The project reports errors and keeps the form input if a save fails. It does not yet have full accounts, cross-device recovery, or moderation.

## Documentation

- Read a bin: https://jsonbin.io/api-reference/bins/read
- Update a bin: https://jsonbin.io/api-reference/bins/update
- Create a bin: https://jsonbin.io/api-reference/bins/create

## Front-end update: September 29

The repeated “Why it matters” paragraph is removed from the star hover text. Location markers keep their mist-blue color and are larger. The galaxy scene is titled **Atlas of Connection**, with a more vivid rose/amber/violet/cyan nebula and brighter twinkling background stars. “No account needed” is italicized.

Atlas hover lines connect to the two nearest stars in the same data category. They are visual guides for exploring that category, not CDC evidence of a relationship between two demographic groups. Aurora colors are a visual interpretation of the displayed isolation percentage; they do not establish causation or predict an individual person's loneliness.

In the participant galaxy, hover lines join up to three other stars in the currently chosen cluster. **Place** groups by entered city and country, **Age** by the galaxy age group, and **Feeling** by the chosen feeling. Any city can form a cluster. This is a constellation layout, not a geographic map or a geocoding service. Letter case and extra spaces are ignored; different spellings such as NYC and New York still form separate clusters.

One browser identity owns one star: submitting again updates that star. Other visitors create their own stars. Preview examples are fictional; the notice remains until the API connects and real contributions exist. If a connected sky is empty, the examples remain labeled as samples. On a later connection failure, the last loaded real stars remain visible with an interruption notice.

The sound icon enables both the bowls and a quiet original ambient pad, built with three p5 sine oscillators at 110, 165, and 220 Hz, a low-pass filter, and reverb. It has no beat or melody. The pad softens for each bowl strike and gently breathes in volume. Switching sound off fades the whole soundscape. These are synthesized sounds, not recordings of singing bowls. Listen and adjust the three ambient volumes in `createAmbientSound()` if needed.

The Atlas of Connection also contains one outlined blue reference star for the CDC's emotional-support measure: 24.1% of adults across the 26 participating states reported receiving needed support sometimes, rarely, or never in 2022. It is separate from participant stars and their voice count. Hover to read it, or click/tap to open the source. The same reference is accessible through Read the stars.
