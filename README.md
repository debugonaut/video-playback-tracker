# Video Playback Tracker (v2.0.4)

A professional playback tracking extension for Chrome and Firefox that automatically saves your video progress.

## 📝 Reviewer Information

### Why `<all_urls>` permission?
This extension is designed to be a **Universal Playback Tracker**. It works by detecting HTML5 video elements across the entire web (YouTube, Twitch, Netflix, etc.) to ensure users never lose their place. To provide this seamless cross-platform experience, the extension requires access to video metadata on all user-visited streaming domains.

### Authentication (Firefox)
To resolve the common "popup closes on window focus loss" issue with native Google OAuth, the Firefox version simplifies the logic by redirecting users to our verified landing page (`https://rewind-player.vercel.app/sync`) for a stable authentication experience.

## 🛠️ Build Instructions

To verify the provided source code, follow these steps:

1.  **Extract the source**: Ensure you have the `src/` directory, `manifest.json`, and `package.json`.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Build the extension**:
    ```bash
    npm run build
    ```
4.  **Verification**: The compiled files (`background.js`, `popup.js`, `content.js`) will be generated in the root directory and will match the provided production binaries.

---
*Built with ❤️ for a seamless video experience.*
