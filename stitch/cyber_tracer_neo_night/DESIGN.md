# Design System Specification: Neon-Brutalist Editorial

## 1. Overview & Creative North Star
### The Creative North Star: "The Kinetic Void"
This design system is a high-performance, dark-mode environment where brutalist rigidity meets the electric energy of a neon future. We move beyond standard dark mode by treating the interface as a physical, light-emitting structure carved out of a deep black void.

The "Kinetic Void" philosophy rejects the safety of soft grids. Instead, we use **Space Grotesk** at extreme scales, high-contrast neon accents, and thick, unapologetic geometry to create a sense of mechanical precision. The design breaks the "template" look through intentional asymmetry—placing content off-center or allowing typography to bleed into the margins—ensuring every screen feels like a custom-designed editorial spread rather than a generic dashboard.

---

## 2. Colors
Our palette is rooted in total darkness, using light not just as a visibility tool, but as a structural material.

*   **The Foundation:** The `background` (#0e0e0e) and `surface_container_lowest` (#000000) provide a "true black" abyss. 
*   **The Accents:** `primary_dim` (#e51152 / Neon Pink) and `secondary` (#f7e600 / Neon Yellow) are used sparingly to draw the eye like tactical laser sights.
*   **The "No-Line" Rule:** Except for the "Brutalist Border" exception (see Elevation), designers are prohibited from using 1px solid dividers for sectioning. Boundaries must be defined by shifts in background tone (e.g., a `surface_container` card sitting on a `surface` background).
*   **Surface Hierarchy & Nesting:** Use tiers to create "tactical depth." 
    *   *Base:* `surface_dim` (#0e0e0e)
    *   *Nesting:* An inner card should use `surface_container_high` (#1f1f1f) to distinguish itself from the parent container without needing a border.
*   **The "Glass & Gradient" Rule:** To provide "visual soul," use semi-transparent versions of `primary` with a 20px-40px `backdrop-blur`. Apply subtle gradients from `primary` (#ff8b9a) to `primary_container` (#ff7388) on high-value CTAs to give them a glowing, volumetric presence.

---

## 3. Typography
We utilize **Space Grotesk** across all tiers. Its geometric, slightly tech-leaning letterforms are the backbone of our "Editorial Brutalism."

*   **Display Scale (display-lg: 3.5rem):** Used for "hero" moments. Do not center-align; use left-aligned, tight-tracked (letter-spacing: -0.02em) headers to create tension.
*   **Headline Scale (headline-lg: 2rem):** Used for section starts. Often paired with a `secondary` (Yellow) accent color.
*   **Body (body-lg: 1rem):** Standard for readability. Ensure `on_surface` (#ffffff) is used for maximum legibility against the dark background.
*   **Label Scale (label-sm: 0.6875rem):** Used for technical metadata. These should be all-caps with generous letter-spacing (+0.1em) to mimic blueprint annotations.

---

## 4. Elevation & Depth
While we embrace "Brutalism," depth is achieved through high-contrast tonal layering rather than traditional drop shadows.

*   **The Layering Principle:** Stacking `surface_container_lowest` (#000000) inside `surface_container_highest` (#262626) creates a "recessed" look, making the UI feel like a machined instrument panel.
*   **Brutalist Borders:** Unlike standard systems, we use **thick, 2px to 4px borders** using the `primary` (Pink) or `on_surface` (White) tokens for primary containers. These must be 100% opaque.
*   **Ambient Shadows:** For floating elements (like Modals), use a highly diffused shadow (40px blur) using a tinted version of `primary` at 10% opacity. This mimics the "glow" of a neon tube.
*   **Glassmorphism:** Use `surface_variant` at 60% opacity with a `backdrop-blur` of 12px for navigation overlays. This maintains the "Kinetic Void" feel by letting light from underlying elements bleed through.

---

## 5. Components

### Buttons
*   **Primary:** Solid `primary_dim` (#e51152) background with `on_primary_fixed` (#000000) text. 4px thick `on_primary_fixed` border for a "stamp" effect. Radius: 0px.
*   **Secondary:** Ghost style. Transparent background, `secondary` (#f7e600) text, and a 2px `secondary` border. 
*   **State:** On hover, the button should "fill" or "invert" colors instantly—no slow transitions.

### Cards & Lists
*   **Cards:** No rounded corners (0px). Use `surface_container` (#191919). Prohibit divider lines between card sections; use a 16px (`spacing.4`) vertical gap instead.
*   **Lists:** List items are separated by a color shift on hover (using `surface_bright`) rather than a line.

### Input Fields
*   **Text Inputs:** Use `surface_container_low` (#131313) as the base. The active state must trigger a 2px `secondary` (Yellow) border.
*   **Labels:** Use `label-md` in `on_surface_variant` (#ababab), positioned strictly above the input.

### Selection Controls
*   **Checkboxes/Radios:** Must be 0px radius (perfect squares). Checked state uses `primary` (#ff8b9a) with a high-contrast white "X" or inner square.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use 0px border radius for everything. The system is built on hard angles.
*   **Do** use extreme typographic contrast (e.g., a `display-lg` header next to a `label-sm` caption).
*   **Do** treat the "Void" (black space) as a design element. Large gaps between components are encouraged.

### Don’t:
*   **Don’t** use soft gradients or pastel colors. Colors should feel "electrified."
*   **Don’t** use standard 1px grey dividers. If you can't separate content with space or color shifts, rethink the layout.
*   **Don’t** use "Drop Shadows" to create depth. Use tonal stacking (darker containers inside lighter ones or vice-versa).
*   **Don't** ever use rounded corners. Even a 2px radius breaks the Brutalist integrity of this system.