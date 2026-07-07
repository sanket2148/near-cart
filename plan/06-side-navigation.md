# Shop Side Navigation Documentation

This document explains the architecture of the responsive Side Navigation Drawer (Sidebar) implemented in the NearCart application.

---

## 1. Directory Structure

The side navigation components and configurations are organized as follows:

```
src/
├── lib/
│   └── navigation.ts        ← Menu configuration & data mapping
└── components/
    ├── SidebarDrawer.tsx    ← Sidebar layout, logic, and rendering
    ├── AppShell.tsx         ← Responsive parent shell layout
    └── AppHeader.tsx        ← Hamburger menu trigger for mobile
```

---

## 2. Menu Configuration (`navigation.ts`)

The side menu is fully decoupled from the UI rendering layer. It is configured in [navigation.ts](file:///d:/near-cart/near-cart/src/lib/navigation.ts).

### NavigationItem Properties
Each navigation item must satisfy the `NavigationItem` structure:
*   `id`: A unique string identifier.
*   `label`: Display name of the item.
*   `icon`: A Lucide React icon component type.
*   `path`: The absolute routing URL path.
*   `roles`: (Optional) Role-based access constraints.
*   `badgeKey`: (Optional) Connects item status to cart/notification counters.

### How to Add a New Standard Menu Item
To add a new static page link to the sidebar:
1. Open [navigation.ts](file:///d:/near-cart/near-cart/src/lib/navigation.ts).
2. Locate the `MENU_SECTIONS` list.
3. Append your new item under the appropriate section:
   ```typescript
   { id: "my-page", label: "My Custom Page", icon: Star, path: "/my-page" }
   ```

## 3. Key UX Features

### Collapsible State
The desktop sidebar is collapsible to 76px (showing only icons and tooltips). State is saved in `localStorage` as `nearcart-sidebar-collapsed` and loaded on component mount to prevent flicker.

### Favorites (Pinning)
Users can hover over any menu item and click the Pin icon to add it to a "Favorites" list displayed at the top of the sidebar. Up to 5 items can be pinned. This persists in `localStorage` under `nearcart-sidebar-pinned`.

### Recently Visited
The sidebar monitors the active route and tracks the last 3 visited sub-pages (e.g. `/orders`, `/settings`), displaying them as quick-access chips. This persists in `localStorage` under `nearcart-sidebar-recent`.

