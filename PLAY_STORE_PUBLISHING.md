# Rams Boutique - Google Play Store Publishing Guide

The Rams Boutique web app is now a **Progressive Web App (PWA)** with:
- `manifest.json` at `/manifest.json`
- Service worker at `/service-worker.js` (offline shell + caching)
- App icons in `/icons/` (72 – 512, plus maskable 512)
- Apple touch icon, favicon
- Install prompt shown automatically in supported browsers

You can publish this to Google Play as a **Trusted Web Activity (TWA)** which is Google's official way to wrap a PWA into a Play Store app. No native code changes needed. Same web app, one deploy, both browser and Play Store users.

---

## Prerequisites

- Your production URL (**https://www.ramsboutique.com** based on your deployment). Must be HTTPS.
- A Google Play Console developer account ($25 one-time fee).
- Node.js 18+ installed locally (only for the build step).

---

## Option A – Bubblewrap CLI (recommended, fully open-source)

Bubblewrap is Google's official TWA generator.

### 1. Install Bubblewrap
```bash
npm install -g @bubblewrap/cli
```

### 2. Initialise the TWA project
```bash
bubblewrap init --manifest=https://www.ramsboutique.com/manifest.json
```

You'll be prompted for:
- **Application ID** – e.g. `com.ramsboutique.vizag`
- **App name** – `Rams Boutique`
- **Launcher name** – `Rams Boutique`
- **Display mode** – `standalone`
- **Orientation** – `default` (or `portrait`)
- **Theme color** – `#6b3410`
- **Background color** – `#ffffff`
- **Start URL** – `/`
- **Icon URL** – already picked from manifest
- **Splash screen color** – `#ffffff`
- **Enable Play Billing** – `No`
- **Signing key** – create a new one (Bubblewrap generates it) and **save the .keystore + password safely** — you'll need the exact same key for future updates.

### 3. Build the release AAB
```bash
bubblewrap build
```
Outputs:
- `app-release-signed.aab` – upload to Play Console
- `app-release-signed.apk` – for sideload/testing

### 4. Digital Asset Links (required for the URL bar to hide)
After the first upload, Play Console will give you a **SHA-256 fingerprint**. Add it to your production site at:

**`https://www.ramsboutique.com/.well-known/assetlinks.json`**

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.ramsboutique.vizag",
    "sha256_cert_fingerprints": ["<SHA-256 FROM PLAY CONSOLE>"]
  }
}]
```

Serve it with `Content-Type: application/json`. This proves you own both the app and the domain — without it, the browser URL bar shows inside the app.

---

## Option B – PWABuilder (no CLI, web wizard)

1. Go to https://www.pwabuilder.com
2. Enter `https://www.ramsboutique.com`
3. It scores the PWA and generates the Android package.
4. Click **Package for Stores → Android** – download the ZIP.
5. Inside is `app-release-signed.aab` and a `assetlinks.json` sample.
6. Follow the included `README.md` to upload to Play Console.

PWABuilder handles signing keys automatically (or you can supply your own).

---

## Play Console Upload Checklist

- App name: **Rams Boutique**
- Short description: *Fresh groceries delivered in Visakhapatnam.*
- Full description: Include hero copy from your site.
- Category: **Shopping** (or **Food & Drink**)
- Content rating questionnaire: complete
- Screenshots: take from your live site on phone-sized viewport (min 2, ideally 4-8). Google Play needs 320-3840 px on any side, 16:9 or 9:16.
- Feature graphic: 1024x500 PNG (can reuse the RB logo on the brown theme).
- Privacy policy URL (required).
- App icon: use `/icons/icon-512.png`.
- **Upload the `.aab`** produced by Bubblewrap/PWABuilder.
- Create an **Internal testing** release first, install on your phone, verify:
  - No URL bar visible (means assetlinks.json is working).
  - App opens `https://www.ramsboutique.com` in standalone mode.
  - Login, cart, checkout, admin flows all work.
- Promote to **Production** once verified.

---

## Auto-update behavior

Because it's a TWA, every time you deploy a new version of the web app, users get the update immediately — **no Play Store approval needed** for content changes. Only re-upload the AAB when:
- You change `manifest.json` in a way that requires a new install
- You bump the app version (e.g. new permissions)

---

## iOS

Users on iOS can install the same PWA via **Safari → Share → Add to Home Screen**. Apple does not currently allow PWAs on the App Store, so iOS distribution is via web only. If you need App Store presence later, we can wrap with Capacitor.

---

## What's already done in this codebase

- ✅ `public/manifest.json` – Rams Boutique metadata
- ✅ `public/service-worker.js` – App-shell caching (skips /api/*)
- ✅ `src/index.js` – Service worker registration on load
- ✅ `public/index.html` – Manifest link, theme-color, apple-touch-icon, mobile meta
- ✅ `public/icons/*` – 9 sizes + maskable
- ✅ `src/components/PWAInstallPrompt.jsx` – In-app install banner using `beforeinstallprompt`

Once you deploy the updated preview to production, the manifest and service worker will be live and Bubblewrap/PWABuilder can generate the AAB.
