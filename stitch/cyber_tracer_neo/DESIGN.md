# Design System Strategy: The Digital Kineticist

## 1. Overview & Creative North Star
The North Star for this design system is **"The Digital Kineticist."** 

We are moving away from the polite, sanitized interfaces of modern SaaS. This system is a celebration of the browser’s raw utility—it is functional, unapologetically digital, and vibrating with energy. By utilizing neo-brutalist principles, we treat the 'Video Playback Tracker' interface not as a passive overlay, but as a high-contrast mechanical tool. 

We break the "template" look through **intentional collision**: overlapping containers, heavy-stroke "sticker" shadows, and a rejection of the 1px divider. The layout should feel like it was assembled, not rendered, using a rigorous 0px radius that reinforces an industrial, "always-on" monitoring aesthetic.

---

## 2. Colors & Surface Logic
This system thrives on extreme contrast. We use a high-saturation palette to draw the eye to critical playback data, while using deep blacks and off-whites to ground the experience.

### The Palette
- **Primary (`#b9003f`):** Our Vibrant Pink. Used for active tracking states and critical "Live" indicators.
- **Secondary (`#f7e600`):** Cyber Yellow. Used for warnings, timestamps, and secondary highlights.
- **Surface & Backgrounds:** We utilize `#f9f9f9` (Surface) and `#000000` (On-Background) to create a stark, paper-vs-ink environment.

### The "No-Line" Rule
Standard 1px borders are strictly prohibited for sectioning. In this system, boundaries are defined by **Color Blocks** and **Hard Shadows**. 
- To separate sections, shift from `surface` to `surface-container-low`.
- For extreme separation, use a `primary` or `secondary` background block with `on-primary` text.

### Surface Hierarchy & Nesting
Instead of soft elevations, we use "Sticker Stacking." 
1. **Base Layer:** `surface` (#f9f9f9).
2. **Interactive Layer:** `surface-container-lowest` (#ffffff) with a 3px solid black border.
3. **Information Wells:** `surface-container-high` (#e8e8e8) inset within the interactive layer to show historical data or logs.

### Signature Textures
While the system is brutalist, we avoid "flatness" by using **High-Contrast Gradients**. Use a linear gradient from `primary` (#b9003f) to `primary-container` (#e51152) for main action buttons. This adds a "neon tube" glow that feels premium and intentional rather than generic.

---

## 3. Typography
The typography is designed to mimic technical manuals and digital tickers.

- **Display & Headlines (Space Grotesk):** These should be set with tight letter-spacing (-2%) and high line-height to feel like editorial headlines. Use `display-md` for big playback percentages.
- **Body & Titles (Manrope):** A high-readability sans-serif that balances the raw energy of Space Grotesk.
- **UI Labels & Timestamps:** Use `label-md` (Space Grotesk). For timestamps, ensure uppercase styling to maintain the "industrial" feel.

The hierarchy is "Top-Heavy": headings should be significantly larger than body text to create a sense of information dominance.

---

## 4. Elevation & Depth: Hard-Edge Brutalism
Traditional soft shadows have no place here. Depth is mechanical, not optical.

- **The Sticker Effect:** Every floating element (Cards, Tooltips, Modals) must use a **Hard Shadow**. 
  - **Shadow Token:** `4px 4px 0px 0px #000000`.
  - This creates the "sticker" look, making the UI feel like physical layers of vinyl applied to the screen.
- **The Heavy Outline:** All containers must feature a 2px or 3px solid border using the `on-background` (#1a1c1c) token.
- **Zero Softness:** The `roundedness` scale is locked at **0px**. Every corner is a sharp right angle, emphasizing the "Tracker" as a precision instrument.
- **Glassmorphism (The "HUD" Exception):** For elements that overlay the video itself, use `surface` at 80% opacity with a `20px` backdrop-blur. This is the only place where "softness" is allowed, simulating a Heads-Up Display.

---

## 5. Components

### Buttons
- **Primary:** Background `primary`, 3px black border, 4px hard black shadow. On hover, the shadow disappears, and the button "depresses" (translate X: 2px, Y: 2px).
- **Secondary:** Background `secondary` (Cyber Yellow), same border/shadow rules.

### Input Fields
- **Default:** `surface-container-lowest` background, 2px black border. 
- **Focus:** Background shifts to `primary-fixed` (#ffd9dc), and the border thickens to 3px.

### Cards & Lists
- **Forbid Dividers:** Do not use lines to separate list items. Instead, alternate backgrounds between `surface` and `surface-container-low`, or use `2.5` (0.5rem) of vertical spacing.
- **The "Data Block":** Use a `secondary` background for the leading element (e.g., the "Time Watched" number) to create an immediate focal point.

### Video Playback Progress Bar
- **Track:** `surface-container-highest` (#e2e2e2).
- **Indicator:** `primary` (#b9003f).
- **Handle:** A 12px x 12px square (0px radius) with a 2px black border.

---

## 6. Do’s and Don’ts

### Do
- **Do** overlap elements. Let a "Live" badge break the border of its parent container.
- **Do** use `display-lg` typography for single, impactful numbers.
- **Do** use the `24` (5.5rem) spacing scale to create massive "dead zones" of whitespace between major functional blocks.

### Don’t
- **Don't** use border-radius. A single 4px corner ruins the industrial tension of the system.
- **Don't** use grey shadows. If a shadow isn't pure black (#000000), it’s wrong.
- **Don't** use 1px lines. If an element needs a border, make it a 3px statement.
- **Don't** use "Soft" colors. If the color doesn't feel like it belongs on a warning sign or a neon light, it's too muted.

---

## 7. Spacing & Rhythm
This system uses a **Compressed/Expanded** rhythm. 
- **Compressed:** UI labels and their data points should be tight (`spacing-1` or `1.5`) to feel like a dense readout.
- **Expanded:** Major sections should be separated by `spacing-8` or `10` to allow the high-contrast elements room to breathe.

By following this system, the 'Video Playback Tracker' will feel less like a browser utility and more like a professional-grade command center for digital media.