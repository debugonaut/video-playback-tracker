# █ REWIND: SYSTEM_DEVLOG_v2.1
## // A FULL DEVLOG — FROM FRUSTRATION TO FIREFOX APPROVAL.

---

### [ > ] 01. THE_IDEA
It started with a simple frustration. Some streaming platforms remember where you left off. Others don't. And none of them talk to each other. If you watch something on Netflix, pause halfway through a YouTube documentary, then catch up on a Crunchyroll episode — you're on your own. You're left remembering timestamps in your head, or worse, scrubbing through videos trying to find where you were.

I wanted one place. A single dashboard where every video I'd ever watched — regardless of platform — showed up with a timestamp and a direct link back. Click it, and you're right where you left off.

That was the whole idea. It sounds simple. It wasn't.

---

### [ > ] 02. FIGURING_OUT_THE_ARCHITECTURE
The first real question was: how do you even capture a timestamp from a website you don't own? You can't just ask Netflix to give you that data. So the answer was a browser extension — a piece of code that runs inside the browser itself, with access to the page's DOM and all the media elements on it.

The plan took shape pretty quickly:
- `[NODE_01]` A browser extension that silently watches for video playback on any site
- `[NODE_02]` A web dashboard where all your saved timestamps live
- `[NODE_03]` A sync pipeline connecting the two

Simple on paper. The execution was a different story entirely.

---

### [ > ] 03. BUILDING_THE_EXTENSION

#### // THE_SPA_PROBLEM
The first wall I hit was the nature of modern streaming sites. Netflix and YouTube are Single Page Applications (SPAs) — they don't reload the page when you navigate between videos. They tear down the DOM and rebuild it dynamically. That means the classic `window.onload` listener you'd use to detect a new page? Completely useless here.

The solution was the `MutationObserver` API. Instead of waiting for a page load, it binds directly to the root of the document and watches for any structural changes in the DOM tree — in real time. The moment a video element appears or gets swapped out, the extension knows about it.

#### // HANDLING_MULTIPLE_VIDEO_ELEMENTS
Another wrinkle: modern streaming sites often have more than one video tag active at once. Netflix uses hidden video elements for hover previews. YouTube pre-buffers the next video in the background. If you're not careful, you end up tracking the wrong one.

To solve this, I used a `WeakSet` — a memory structure that holds references to registered video elements. The key advantage of a `WeakSet` over a regular `Set` is that when the SPA destroys a video element, the `WeakSet` automatically drops its reference. No manual cleanup, no memory leaks building up over long viewing sessions.

#### // CATCHING_EVERY_EXIT
Once a valid video element was found, the extension hooks into four events: `play`, `pause`, `loadedmetadata`, and `ended`. The `pause` event handles most cases — manual pauses, browser-forced suspensions, background tabs getting throttled.

But there was a glaring edge case: what happens when a user just closes the tab? No `pause` event fires. The browser just kills the thread.

Two redundancies were built to handle this:
1. A **periodic sync loop** that fires every 30 seconds while a video is playing, saving state to local storage as a background checkpoint.
2. A **`beforeunload` hook** — a final save triggered milliseconds before the browser destroys the tab. It checks if the video is actively playing and has surpassed 5 seconds of watch time (to filter out autoplay ads) and fires off a last payload.

#### // EXTRACTING_THE_TITLE
Saving a timestamp is useless without knowing what you were watching. Extracting the title turned into its own mini-project because every platform does it differently.

The approach became a waterfall:
1. **Try platform-specific CSS selectors.** YouTube hides the title deep inside its Shadow DOM. Netflix uses dynamically generated class names that change regularly.
2. If unknown, **fall back to OpenGraph and Twitter Card meta tags** in the page head — most streaming sites include these for social sharing, and they usually contain a clean title.
3. Last resort: **scrape `document.title` directly and run a regex** to strip out the platform branding that gets appended (e.g., `"Episode 14 - Watch Free on Crunchyroll"` becomes just `"Episode 14"`).

---

### [ > ] 04. THE_AUTHENTICATION_PROBLEM
Here's something that sounds like it should be easy but absolutely isn't: how does the extension know who you are?

Browser extensions are sandboxed. They have no access to your session cookies, HttpOnly tokens, or any auth state from the websites you're logged into. Asking users to log in separately inside the extension popup creates friction and runs into CORS issues with OAuth flows.

#### // NEURAL_SYNC
The solution I designed is something I called **Neural Sync**. It works like this:
1. You log into the web dashboard normally. Firebase Auth handles the session and stores your user ID.
2. Once authenticated, the dashboard quietly mounts a hidden `div` on the page with your user ID embedded in a `data` attribute.
3. The extension, when it detects it's running on the dashboard domain, polls the DOM every 2 seconds looking for that element.
4. The moment it finds it, it reads the token, terminates the polling loop, and passes the token to the background service worker via `chrome.runtime.sendMessage`.
5. From that point on, every video payload the extension sends includes your user ID.

Zero login screens. Zero popups. Zero user interaction. You visit the dashboard once and the extension pairs itself silently.

---

### [ > ] 05. THE_SYNC_PIPELINE_AND_DUAL_BUCKET_SYSTEM
The extension capturing data and the dashboard displaying it are two completely separate systems. Getting data reliably from one to the other — especially when the extension might be offline, on a shaky network, or running in a restricted browser context — required careful architecture.

**Why not write directly to the database?**
The extension operates in an unstable environment. Requiring it to make authenticated, validated writes directly to a secure Firestore database is a recipe for dropped data and auth failures. Instead, it fires payloads into a temporary, loosely permissioned buffer bucket. Think of it as a dropbox.

When you open the web dashboard — where you're fully authenticated — it listens to that buffer in real time. For every entry it finds, it validates the structure, replaces any client timestamps with a server-generated atomic timestamp, writes the clean record to your permanent history, and deletes the original from the buffer.

The extension never touches your permanent data. It's just a messenger. The dashboard is the gatekeeper.

---

### [ > ] 06. ERRORS_AND_ANOMALIES: THE_BUGS_THAT_NEARLY_BROKE_EVERYTHING

#### // THE_GHOST_DELETION_BUG
This one took a while to find because on the surface, everything looked fine. Users could delete entries. The UI confirmed the deletion. No errors. But on the next page refresh, the deleted item came back — like nothing had happened.

The root cause was a JavaScript object spread ordering issue. The extension was packaging its video data with an internal tracking field: `id: Date.now()` — a numeric integer. When the dashboard mapped Firestore snapshots to an array, the standard pattern looked like this:
```javascript
const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```
The problem: JavaScript's spread operator processes right to left. The `...doc.data()` spread, which contained the numeric `id` from the extension, was silently overwriting the true Firestore string document ID that was set first. So when the delete function ran, it was trying to delete a document named `1714023456789` — which didn't exist. Firebase returned a success response and the UI showed no error. But the actual document, named something like `aHR0cHM6...`, was untouched.

The fix was a single-word change — move the spread *before* the id assignment:
```javascript
const data = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
```
Now the true Firestore document ID always wins, regardless of what's embedded in the payload.

#### // THE_FIREFOX_BLACKOUT
Chrome worked perfectly. Every Firebase request went through cleanly. So when I started testing the Firefox build, I expected maybe some minor differences in manifest syntax. What I got was complete silence — the extension appeared to run, timestamps were being captured, but nothing ever reached the database.

No errors. No warnings. Just nothing.

The issue was Firefox's Content Security Policy enforcement under Manifest V2. Firebase doesn't just use simple HTTP requests — it relies on WebSockets (`wss://`), long-polling connections, and multiple `googleapis` domains. Without an explicit CSP whitelist, Firefox silently blocked all of it. The fix was adding a `connect-src` directive to the Firefox manifest that explicitly permits Firebase's domains and WebSocket endpoints.

After that, Firefox sync worked identically to Chrome.

#### // THE_ENTRY_THAT_REFUSED_TO_LEAVE_THE_TOP
During testing, one manually-added entry — *Modern Family* — was permanently pinned to the top of the dashboard list. Thirty newer entries came in and sorted correctly beneath it. *Modern Family* stayed at the top no matter what.

The cause was a Firestore type sorting quirk. Firestore's descending sort puts strings above numbers. The manual entry form was saving the timestamp as an ISO string. The extension was saving it as a Unix epoch integer. In Firestore's internal type hierarchy, any string sorts above any number — so a single ISO-format entry would sit above every extension-recorded entry no matter how recent they were.

The fix was standardising all timestamp writes across every entry point to use `Date.now()` integers.

#### // THE_VITE_PRODUCTION_CRASH
The final bug was the most obscure. The "Clear All" function used dynamic imports to load a Firebase batch-write utility: `const { writeBatch } = await import('firebase/firestore')`. This worked perfectly in development. In production on Vercel, it failed intermittently with silent catch-block errors.

Vite's production build aggressively chunks dynamic imports into separate network-loaded files. But the main Firebase `db` instance was statically imported at the top of the file. The two ended up initialising at different times, causing the Firebase core to occasionally not recognise the module instance coming from the async chunk.

The fix was removing all dynamic imports from the application and committing to static imports throughout. A small Lighthouse score trade-off, but it eliminated the race condition entirely.

---

### [ > ] 07. THE_DASHBOARD
The UI was never an afterthought. A plain, sterile dashboard felt wrong for something built out of personal frustration. I wanted something that felt like a real tool — something with personality.

The design language is **Neo-Brutalism**: hard borders, heavy shadows with no blur, stark contrast, and motion that feels physical rather than decorative. Cards press down when you hover them. Items animate into position using spring physics rather than eased transitions, so the interface feels like it has real weight.

Dark mode is fully supported and handled through a React Context Provider — not a simple CSS inversion, but a genuine re-theming of every color variable in the system.

The frontend is built with React and Vite. Vite was chosen over Next.js specifically for its sub-second hot module replacement during the debugging-heavy phases of development. Framer Motion handles all list animations — when the database updates, items don't snap into their new positions; they physically traverse to them.

---

### [ > ] 08. CROSS_BROWSER_AND_THE_MANIFEST_SPLIT
Chrome and Firefox have fundamentally different extension architectures. Chrome runs Manifest V3. Firefox still enforces Manifest V2. These are not just version numbers — they represent different permission models, different background script types, and different security philosophies.

Maintaining two separate manifest files (one per browser) with shared core logic was the only viable approach. The Chrome build uses service workers and host permissions. The Firefox build requires explicit background scripts and Content Security Policy declarations. The codebase handles both cleanly through a build flag.

---

### [ > ] 09. THE_TECHNOLOGY_STACK
- **Chrome Extension** — Manifest V3, service workers, MutationObserver, WeakSet
- **Firefox Extension** — Manifest V2, background scripts, explicit CSP
- **React + Vite** — frontend dashboard, hooks-based state management
- **Firebase Firestore** — dual bucket database architecture, real-time listeners
- **Firebase Auth** — JWT-based authentication, Google OAuth
- **Framer Motion** — physics-spring list animations, AnimatePresence
- **TailwindCSS** — layout and grid utilities
- **Vercel** — production deployment

---

### [ > ] 10. WHAT'S_NEXT
The core of Rewind does exactly what it was built to do. But there's a longer roadmap:
- `[ ]` Client-side search and filtering by platform, date range, or title
- `[ ]` Domain blacklists — the ability to exclude specific sites (banking, work tools, private servers) from being tracked
- `[ ]` CSV and JSON export for offline archives
- `[ ]` Predictive pre-fetching — surfacing videos you're likely to return to based on viewing patterns

For now though — it works. Firefox approved it. Chrome runs it. The bugs are gone. And every timestamp I care about is exactly where I need it.

---
`// EOF`
`// BUILT BY HAND. FIXED BY STUBBORNNESS.`
