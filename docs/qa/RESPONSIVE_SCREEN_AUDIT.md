# Responsive & Cross-Viewport Screen Rendering Audit

> **Scope & Method:** Primary-source codebase audit across `src/`, `index.html`, and `tailwind.config.ts` (following ECC `design-system` / `browser-qa` criteria and Matt Pocock `research` workflow). Live headless/Chrome DevTools viewport screenshots were not captured in this pass because Chrome remote debugging (`DevToolsActivePort`) was unavailable on the host.

---

## 1. Breakpoint System & Viewport Hooks

### Tailwind Breakpoints
- `tailwind.config.ts:14-21` defines `theme.container.screens['2xl'] = '1400px'` and does **not** override `theme.screens` or `theme.extend.screens`. Standard Tailwind breakpoints apply across the app: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px), `2xl` (1536px).
- An ad-hoc arbitrary breakpoint `min-[380px]:` is used in `src/features/seller/components/SellerProfileHero.tsx:65,157,180,191,195,207,211` to separate small phones (<380px) from standard phones (≥380px).

### Custom CSS Media Queries & Cascade Conflict
- **[Medium] Duplicate `html` root `font-size` rules with cascade conflict (`src/app.css:8-15` vs `src/app.css:343-357`)**:
  - Unlayered rules at `src/app.css:8-15` set `html { font-size: 14px; }` and `@media (min-width: 640px) { html { font-size: 15px; } }`.
  - `@layer base` rules at `src/app.css:343-357` set `14px` base, `15px` at `@media (min-width: 768px)`, and `16px` at `@media (min-width: 1024px)`.
  - Because unlayered CSS overrides `@layer base` in the CSS cascade, the `@layer base` `16px` bump at `1024px+` never takes effect; desktop viewports stay at `15px` root `font-size`.
- **Sonner toast mobile constraint (`src/app.css:154-158`)**: `@media (max-width: 600px)` caps `[data-sonner-toaster]` to `max-width: calc(100vw - 32px)`.
- **Standalone / fullscreen PWA media queries**: `index.html:170,196` and `src/app.css:58` use `@media (display-mode: standalone)` and `@media (display-mode: fullscreen)`.

### Viewport Hooks
- There are **no** `useIsMobile`, `useMediaQuery`, or `window.innerWidth` viewport-size hooks in `src/`.
- `window.matchMedia` is used only for `(prefers-color-scheme: dark)` (`src/app/bootstrap/ThemeManager.tsx:77`, `src/shared/hooks/useAppTheme.ts:14,156`, `src/shared/ui/ThemeSegmentedPill.tsx:25`, `src/features/marketing/pages/MarketingDashboard.tsx:50`), `(display-mode: standalone)` (`src/app/bootstrap/ThemeManager.tsx:63`, `src/infrastructure/navigation/platformDetection.ts:39`, `src/features/shop/pages/MarketplaceIndex.tsx:14`), and `(prefers-reduced-motion: reduce)` (`src/features/creator/components/CreatorEarningsHero.tsx:25`).
- All responsive layout adaptation is CSS/Tailwind-driven.

---

## 2. Viewport Height, Safe Areas & Android Insets

### Viewport Meta & Root Sizing
- `index.html:7`: `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` enables edge-to-edge rendering on notched iOS and Android WebView devices.
- `index.html:17-25` & `src/app.css:17-25`: `html, body, #root` set `height: 100%`, `min-height: -webkit-fill-available`, `min-height: 100dvh`, and `overflow-x: hidden`.

### Safe-Area & Android Native Insets
- `src/app.css:40-43`: Defines `--sat`, `--sab`, `--sal`, `--sar` via `env(safe-area-inset-*, 0px)`.
- `src/app.css:58-68`: Standalone PWAs enforce `--sab: max(env(safe-area-inset-bottom, 0px), 20px)`.
- `src/app.css:90-103`: Native Capacitor / Android classes (`html.native-app`, `html.capacitor-native`, `html.android-native`, applied via `index.html:44-48` and `src/app/bootstrap/ThemeManager.tsx:56-58`) enforce fallback insets `--sat: max(env(safe-area-inset-top, 0px), 36px)` and `--sab: max(env(safe-area-inset-bottom, 0px), 16px)`.
- `src/app.css:106-111`: `.pt-safe-top` and `.pb-safe-bottom` (with `16px` minimum bottom padding).

### Findings
- **[High] Floating bottom navigation bars ignore `--sab` / `env(safe-area-inset-bottom)`**:
  - `src/features/buyer/components/dashboard/BuyerBottomNav.tsx:35`, `src/features/seller/components/dashboard/widgets/SellerDashboardTabs.tsx:48`, `src/features/creator/components/CreatorDashboardTabs.tsx:41`, and `src/shared/ui/DashboardSkeleton.tsx:62` position the floating nav with `fixed bottom-4 sm:bottom-5` (16px / 20px) without adding `var(--sab, env(safe-area-inset-bottom, 0px))`.
  - On iOS devices with a Home Indicator (34px bottom inset) or Android edge-to-edge gesture bars, the floating nav sits inside the system gesture zone.
- **[High] `InstallPrompt` fixed bottom banner collides with dashboard floating bottom navs (`src/features/pwa/InstallPrompt.tsx:80`)**:
  - `InstallPrompt` renders `fixed inset-x-0 bottom-0 z-50` on mobile web when not yet installed.
  - Because `BuyerBottomNav`, `SellerDashboardTabs`, and `CreatorDashboardTabs` also use `fixed bottom-4 z-50`, the install banner overlaps and obscures the bottom navigation bar.
- **[High] `BagSheet` collapsed bar overlaps `ShopPage` product grid (`src/features/shop/pages/ShopPage.tsx:175` & `src/features/shop/components/BagSheet.tsx:76-86`)**:
  - When items are in the bag, `BagSheet.tsx:76` renders a `fixed inset-x-0 bottom-0 z-40` bar (`Tap to view bag`).
  - `ShopPage.tsx:175` only applies `pb-6 sm:pb-8` (24px / 32px) to `<main>`, without reserving space for the fixed bag bar, causing it to cover the bottom row of products.
- **[Medium] `100vh` / `vh` usage instead of `dvh` in modals & sheets**:
  - `src/features/shop/components/BagSheet.tsx:95,107` uses `max-h-[92vh]` for the expanded checkout sheet and `max-h-[26vh]` for the pinned item list. On mobile browsers / Android WebView with dynamic URL bars or an open soft keyboard, `vh` can exceed the visual viewport and clip content.
  - `src/features/admin/components/AdminBroadcastModal.tsx:111` and `src/features/buyer/components/RefundConfirmDialog.tsx:56` use `max-h-[90vh]` instead of `max-h-[90dvh]`.
- **[Medium] Legacy `min-h-screen` (`100vh`) without `min-h-[100dvh]` fallback on several pages**:
  - `src/features/shop/pages/ShopPage.tsx:48,66,108`, `src/features/shop/pages/TrackingPage.tsx:94,107,125`, `src/features/auth/pages/VerifyEmail.tsx:106`, `src/features/auth/pages/ResetPasswordPage.tsx:123,148`, `src/features/buyer/pages/BuyerForgotPassword.tsx:41`, `src/features/buyer/pages/BuyerResetPassword.tsx:34,57`, `src/features/creator/pages/CreatorRegister.tsx:156,170`, `src/shared/components/ErrorBoundary.tsx:21,96,182`, and `src/shared/components/NotFound.tsx:6` use `min-h-screen` (`100vh`) instead of `min-h-[100dvh]` / `min-h-[100svh]`.

---

## 3. Layout Shells & Navigation Across Portals

1. **Public Marketplace / Landing (`/` — `src/features/shop/pages/MarketplaceIndex.tsx`)**:
   - `MarketplaceIndex.tsx:27-35`: Full-viewport flex column (`min-h-[100dvh] min-h-[100svh]`) with explicit `env(safe-area-inset-*)` padding on all 4 sides and `overflow-x-hidden overflow-y-auto`.
   - `MarketplaceIndex.tsx:36-48`: Floating Mzigo Ego button positioned `absolute` at `top: max(2.5rem, calc(env(safe-area-inset-top, 0px) + 0.85rem))`.
   - `MarketplaceIndex.tsx:50-124`: Single-column centered stack on `<1024px` (`lg:`), switching to a 50/50 split (`lg:flex-row lg:w-1/2`) on `lg:` (1024px+) with the illustration on the left and logo + 3 CTAs on the right.

2. **Buyer Portal & Storefront (`src/features/buyer/pages/BuyerDashboard.tsx`, `src/features/shop/pages/ShopPage.tsx`, `src/features/shop/components/BagSheet.tsx`)**:
   - `BuyerDashboard.tsx:109-114`: Locked `100dvh` flex column (`height: '100dvh', overflowY: 'hidden'`) with `BuyerDashboardHeader` (`src/features/buyer/components/dashboard/BuyerDashboardHeader.tsx:33-120`), internal scroll body (`paddingBottom: 'calc(4.75rem + var(--sab, env(safe-area-inset-bottom, 0px)))'` at `BuyerDashboard.tsx:133`), `DashboardProfilePanel` (`BuyerDashboard.tsx:206-219`), and `BuyerBottomNav` (`fixed bottom-4 ... w-[360px] max-w-[calc(100vw-1.5rem)]`, `BuyerBottomNav.tsx:35`).
   - `ShopPage.tsx:118-129`: Wraps `AppHeader` inside a redundant `<div className="sticky top-0 z-50">` (creating nested sticky headers since `AppHeader.tsx:34` is already `sticky top-0 z-50 pt-safe-top`), followed by `ShopHero` (`max-w-4xl`), a 2/3/5/6-column product grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6` at `ShopPage.tsx:229`), and `BagSheet` (`BagSheet.tsx:24-288`).

3. **Seller Dashboard (`src/features/seller/pages/SellerDashboard.tsx`)**:
   - `SellerDashboard.tsx:247`: Locked `100dvh` flex column (`minHeight: '100dvh', height: '100dvh', overflowY: 'hidden'`), `SellerDashboardHeader` (`AppHeader`), internal scroll container (`paddingBottom: 'calc(5.75rem + var(--sab, env(safe-area-inset-bottom, 0px)))'` at `SellerDashboard.tsx:265`), `DashboardProfilePanel` (`SellerDashboard.tsx:310-327`), and `SellerDashboardTabs` (`fixed bottom-4 ... w-[360px]`, `SellerDashboardTabs.tsx:48`). Both desktop and mobile use the same 360px floating bottom pill nav.

4. **Admin Dashboard (`src/features/admin/pages/NewDashboardPage.tsx`)**:
   - `NewDashboardPage.tsx:147-195`: Normal document-scroll layout (`min-h-full overflow-x-hidden`), `AppHeader` with icon-only action buttons on `<640px` (`hidden sm:inline` labels at `NewDashboardPage.tsx:169,182`), 5-tile "Needs attention" grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-5` at `NewDashboardPage.tsx:199`), and `AdminDashboardTabs` (`AdminDashboardTabs.tsx:26-27`), which is a sticky horizontally scrollable tab bar (`flex-nowrap overflow-x-auto no-scrollbar`) on `<768px` and `md:flex-1` equal-width tabs on `md:`+.

5. **Auth Pages (`BuyerLogin.tsx`, `BuyerRegister.tsx`, `SellerLogin.tsx`, `SellerRegistration.tsx`, `VerifyEmail.tsx`, `AdminLoginPage.tsx`)**:
   - `BuyerLogin.tsx:117-145` & `BuyerRegister.tsx:38-77`: Use `.auth-page` (`src/app.css:384-391`), sticky `pt-safe-top` header with `absolute left-1/2 -translate-x-1/2 max-w-[46%]` centered title (`BuyerLogin.tsx:134`, `BuyerRegister.tsx:62`), and centered `max-w-md` card.
   - `AdminLoginPage.tsx:47`: Uses `items-start ... sm:items-center` so tall forms don't clip at the top on short mobile viewports.

---

## 4. Common Responsive Failure Patterns

### A. Unbounded Fixed Widths & Overflow Risks
- **[Medium] `SellerProfileHero.tsx:75-218` cramped 3-column metrics beside 96px avatar on 320–360px**:
  - `SellerProfileHero.tsx:75,79` places a `h-24 w-24` (96px) avatar + `gap-5` (20px) beside a 3-column metrics grid (`Sales`, `Revenue`, `Balance`).
  - On a 320px–360px viewport (`px-4` = 32px), only ~172px–212px remains for 3 columns (~57px–70px each). Clicking a metric to expand it (`SellerProfileHero.tsx:58,65`) displays full currency strings, which get clipped by `truncate` on `renderMetricValue` (`SellerProfileHero.tsx:65`).
- **[Low] `MarketplaceIndex.tsx:56` & `71,78`**: Illustration uses `h-[406px] w-[490px] max-h-[75vh] max-w-full` (safe due to `max-w-full` and `hidden lg:flex`), and logo uses `h-[187px] w-[187px]` (fits 320px).
- **[Low] `BuyerBottomNav.tsx:35`, `SellerDashboardTabs.tsx:48`, `CreatorDashboardTabs.tsx:41`**: Fixed `w-[360px]` is guarded by `max-w-[calc(100vw-1.5rem)]`, shrinking cleanly to `296px` on a `320px` screen.

### B. Tables Without Mobile Card Fallbacks / Hidden Scrollbars
- **[High] Admin data tables rely on `overflow-x-auto no-scrollbar` with no mobile card fallback**:
  - `src/features/admin/components/AdminWithdrawalsTab.tsx:119-120`: `<table className="w-full min-w-[560px]">` inside `overflow-x-auto no-scrollbar`. Hiding the scrollbar removes the visual affordance that the table scrolls horizontally on 320–375px screens.
  - `src/features/admin/components/AdminBuyersTab.tsx:48-49`, `src/features/admin/components/AdminCreatorsTab.tsx:79-80`, and `src/features/admin/components/AdminSellersTab.tsx:46-47`: All wrap `<table>` in `overflow-x-auto no-scrollbar touch-pan-x` and hide columns via `hidden md:table-cell` / `hidden lg:table-cell` / `hidden xl:table-cell`, making contact info, linked shops, and join dates inaccessible on mobile/tablet without tapping into a modal (and `AdminCreatorsTab` has no view modal).
  - `src/features/admin/components/AdminSellerRecentOrders.tsx:22-30`: 4-column table inside a modal with `px-8 py-6` cell padding on all breakpoints (no responsive `px-3 sm:px-6`), forcing heavy horizontal scrolling inside `AdminSellerDetailModal` on mobile.

### C. Modals / Drawers / Bottom Sheets Clipping & Z-Index Bugs
- **[High] Nested `Dialog` z-index inversion in `ServiceBookingModal.tsx:226-227`**:
  - `src/shared/ui/dialog.tsx:22,48` sets `DialogOverlay` to `z-[100]` and `DialogContent` to `z-[101]`.
  - `src/features/shop/components/ServiceBookingModal.tsx:227` renders a nested location-picker `<DialogContent className="... z-[60]">`. Because `z-[60]` overrides `z-[101]` in `cn()`, the nested modal content renders **behind** the `z-[100]` overlay.
- **[Medium] `DialogContent` default padding/overflow on short screens (`src/shared/ui/dialog.tsx:48`)**:
  - `DialogContent` sets `max-h-[85dvh]` and `p-6`, but does **not** include `overflow-y-auto` by default. Consumers that omit `overflow-y-auto` (e.g., `src/features/orders/components/BuyerOrderDialogs.tsx:74,123` or `src/features/creator/pages/CreatorRegister.tsx:348`) can clip content on short mobile viewports.
- **[Medium] `OrderDetailsDialog.tsx:20,32` constrained scroll height**:
  - `OrderDetailsDialog.tsx:32` sets `max-h-[60dvh] overflow-y-auto`, which works well, though on short screens (`<600px` height) combined with `DialogHeader` + `DialogFooter`, the outer `DialogContent` (`max-h-[85dvh]`) can still clip if the footer wraps vertically.

### D. Text Truncation & Wrapping Issues
- **[Medium] `AdminDashboardTabs.tsx:35` `whitespace-nowrap` on 8-tab bar at `md:` (768px)**:
  - Each tab uses `md:flex-1 ... whitespace-nowrap px-2.5 sm:px-3 md:px-4 text-xs md:text-sm`.
  - With 8 tabs + icons + numeric count badges, at `768px` (`md:`) the 8 `md:flex-1` items with `md:px-4` and `whitespace-nowrap` total >768px, forcing horizontal scrolling even on tablet (`md:`).
- **[Low] `BuyerLogin.tsx:134-136` & `BuyerRegister.tsx:62-66` header title truncation**:
  - The centered title uses `max-w-[46%]` with `truncate`. On 320px viewports (`46%` = 147px) with `text-xl` + icon + gap, longer portal titles sit close to the `Back` button.

### E. Tablet (768px / `md`) Awkwardness
- **[Medium] `ShopPage.tsx:229` vs `SellersGrid.tsx:103` grid column jump between `sm:` / `md:` and `lg:`**:
  - `ShopPage.tsx:229`: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6` skips 4 columns at `md:` (768px–1023px), jumping from 3 columns at 640px straight to 5 columns at 1024px.
  - `SellersGrid.tsx:103`: `max-w-[760px] md:max-w-none` with `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` switches from 2 capped columns to 3 full-width columns at 768px.
- **[Medium] `AdminOverviewTab.tsx:93` analytics grid skips `md:`**:
  - `<div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">` stacks all 6 analytics charts in a single column on tablets (768px–1023px) instead of using a 2-column tablet grid (`md:grid-cols-2`).
- **[Medium] Desktop/Tablet navigation parity**:
  - `BuyerBottomNav.tsx:35`, `SellerDashboardTabs.tsx:48`, and `CreatorDashboardTabs.tsx:41` render a fixed `360px` bottom pill on **all** breakpoints (including 768px tablet and 1440px+ desktop), with no tablet/desktop sidebar or top-nav transition.

