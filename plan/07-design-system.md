# NearCart — Brand Design System

This document outlines the core brand identity, visual guidelines, and design tokens for **NearCart**, ensuring a premium, consistent, and recognizable experience across both the web and mobile platforms.

---

## 1. Brand Identity

*   **Core Emotion**: "Fast, fresh, local, and modern."
*   **Branding Tone**: Trustworthy, warm, and highly visual.
*   **Design Philosophy**: Focus on rich typography, harmonious curated colors, soft shadows, plenty of whitespace, and micro-interactions.

---

## 2. Design Tokens

### A. Colors (Curated HSL & Hex)

| Token Name | Hex Code | Description | Role / Usage |
| :--- | :--- | :--- | :--- |
| **Primary (Green)** | `#259F56` | Vibrant emerald green | Brand identity, primary CTA, active states |
| **Primary Light** | `#DCFCE7` | Soft pastel green | Successful notifications, badge backgrounds |
| **Accent (Orange)** | `#F3821D` | Juicy amber orange | Ratings, alerts, featured deals, currency |
| **Accent Light** | `#FFEDD5` | Soft pastel orange | Highlight tags, warning badges |
| **Background** | `#FBFCF8` | Warm off-white | Global viewport canvas |
| **Surface** | `#FFFFFF` | Pure white | Cards, sheets, sections |
| **Border** | `#E2E8F0` | Clean light gray | Separation lines, input outlines |
| **Text Dark** | `#0D1F16` | High-contrast deep forest green | Primary headers, bold titles |
| **Text Muted** | `#64748B` | Slate gray | Secondary captions, subtexts |

### B. Typography
*   **Primary Font**: Plus Jakarta Sans (fallback to system sans-serif)
*   **Weight Scale**:
    *   *Heavy/Extrabold*: 800/900 (for section titles and branding)
    *   *Semibold*: 600/700 (for secondary headings, buttons, and metadata)
    *   *Regular*: 400/500 (for description text)

### C. Spacing Scale (4dp grid)
*   `xs`: 4px
*   `sm`: 8px
*   `md`: 12px
*   `lg`: 16px
*   `xl`: 24px
*   `xxl`: 32px

### D. Border Radius
*   `button`: 12px (rounded-xl)
*   `card`: 18px (rounded-2xl)
*   `badge`: 8px (rounded-lg)

---

## 3. Reusable Component Rules

1.  **Shop Card**:
    *   Must feature a rounded-2xl (`18px`) container with a soft border (`#E2E8F0`).
    *   Large emoji/image thumbnail (`44px` with rounded-xl).
    *   Bold name (`#0D1F16`), Slate-gray tagline (`#64748B`), and details row showing rating badge and ETA.
2.  **Product Card**:
    *   Soft shadow, rounded-2xl (`18px`) outline.
    *   Add CTA must be outline-only (`#259F56`) with a clean background. On add, it turns into a filled counter component.
3.  **Floating Cart Bar**:
    *   Solid brand-colored background (`#259F56`).
    *   Rounded-2xl (`14px`) positioned floating at the bottom with standard viewport padding.
