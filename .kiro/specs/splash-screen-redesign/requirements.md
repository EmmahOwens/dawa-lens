# Requirements Document

## Introduction

This document captures the requirements for the Dawa Lens splash screen redesign. The redesign replaces the existing Framer Motion–only splash screen with a health-aesthetic experience centred on a Rive animation (`splash.riv`). The screen communicates trust, precision, and calm — qualities appropriate for a medicine management app — while loading asynchronously so it never blocks first paint. A Framer Motion fallback activates automatically when the Rive asset fails to load or when the user has `prefers-reduced-motion` enabled. The implementation preserves the existing `isInitializing` pattern in `App.tsx` with zero changes to that file.

## Glossary

- **SplashScreen**: The top-level orchestrator component (`src/components/SplashScreen.tsx`) that owns lifecycle, exit trigger, and reduced-motion gate.
- **RiveSplashCanvas**: A thin wrapper component (`src/components/splash/RiveSplashCanvas.tsx`) around the existing `RiveAnimation` component, wired with splash-specific props and state machine inputs.
- **FallbackSplash**: A pure CSS + Framer Motion component (`src/components/splash/FallbackSplash.tsx`) that mirrors the Rive visual without the `.riv` dependency.
- **SplashShell**: The shared layout shell component (`src/components/splash/SplashShell.tsx`) that provides the fixed full-screen container, background colour, safe-area coverage, and the authoritative exit animation.
- **OrbitalDot**: An extracted sub-component (`src/components/splash/OrbitalDot.tsx`) rendering a single orbiting dot around the logo.
- **SonarRing**: An extracted sub-component (`src/components/splash/SonarRing.tsx`) rendering an expanding sonar-ping ring.
- **RiveAnimation**: The existing generic Rive wrapper component (`src/components/rive/RiveAnimation.tsx`).
- **SplashSM**: The Rive state machine named `SplashSM` inside the `SplashArtboard` artboard in `splash.riv`.
- **splash.riv**: The Rive asset file located at `public/assets/rive/splash.riv`.
- **isInitializing**: A boolean flag from `useApp()` context that is `true` while the app is loading and `false` once ready.
- **shouldExit**: An internal one-way boolean flag (`false → true`) inside `SplashScreen` that triggers the exit animation sequence.
- **onExitComplete**: A callback prop fired exactly once when the exit animation fully completes, signalling the parent to unmount the splash.
- **prefers-reduced-motion**: The OS-level accessibility setting that disables non-essential animations, detected via Framer Motion's `useReducedMotion()` hook.
- **SplashState**: The internal state shape `{ riveLoaded: boolean; riveError: boolean; shouldExit: boolean }` managed inside `SplashScreen`.

---

## Requirements

### Requirement 1: Component Architecture and File Structure

**User Story:** As a developer, I want the splash screen logic decomposed into focused, single-responsibility components, so that the codebase is maintainable and each concern can be tested and modified independently.

#### Acceptance Criteria

1. THE SplashScreen SHALL be refactored into an orchestrator of approximately 60 lines that delegates visual rendering to `RiveSplashCanvas` or `FallbackSplash` and layout to `SplashShell`.
2. THE SplashScreen SHALL create a `src/components/splash/` directory containing `RiveSplashCanvas.tsx`, `FallbackSplash.tsx`, `SplashShell.tsx`, `OrbitalDot.tsx`, and `SonarRing.tsx`.
3. THE SplashScreen SHALL extract `OrbitalDot` and `SonarRing` from the existing `SplashScreen.tsx` into their own files in `src/components/splash/` without changing their logic.
4. WHEN `App.tsx` renders `<SplashScreen />`, THE SplashScreen SHALL function identically to today with no changes required in `App.tsx`.

---

### Requirement 2: Rive Animation Integration

**User Story:** As a user, I want to see a rich Rive-powered animation during app startup, so that the loading experience feels polished and on-brand.

#### Acceptance Criteria

1. THE RiveSplashCanvas SHALL load `splash.riv` from `/assets/rive/splash.riv` using the existing `RiveAnimation` component with artboard `SplashArtboard` and state machine `SplashSM`.
2. WHEN `RiveSplashCanvas` mounts, THE RiveSplashCanvas SHALL set the `start` Boolean input on `SplashSM` to `true` within 50 ms to trigger the Intro animation timeline.
3. WHEN `shouldExit` becomes `true`, THE RiveSplashCanvas SHALL set the `exit` Boolean input on `SplashSM` to `true` to trigger the Exit animation timeline.
4. WHEN the Rive asset loads successfully, THE RiveSplashCanvas SHALL fire `onRiveReady` to notify `SplashScreen` that `riveLoaded` is `true`.
5. THE RiveSplashCanvas SHALL size the Rive canvas to `min(280px, 70vw)` × `min(280px, 70vw)` using `Fit.Contain` and `Alignment.Center` so the artboard scales correctly on all screen sizes.

---

### Requirement 3: Four-Phase Animation Timeline

**User Story:** As a user, I want the splash screen to progress through distinct animation phases — ambient glow, logo intro, breathing pulse, and exit — so that the experience feels intentional and alive.

#### Acceptance Criteria

1. WHEN `SplashScreen` mounts, THE SplashShell SHALL render the `#050505` background synchronously on the first frame so no blank white flash occurs.
2. WHEN `SplashScreen` mounts, THE FallbackSplash SHALL begin the Ambient phase (0–400 ms) by fading in the radial background glow.
3. WHEN the Ambient phase completes, THE FallbackSplash SHALL begin the Intro phase (400–1200 ms) by springing the logo in from scale 0.7 to 1.0 and opacity 0 to 1, expanding the concentric rings, and assembling the app name letter-by-letter.
4. WHEN the Intro phase completes, THE FallbackSplash SHALL enter the Breathe phase (1200 ms onward) with a slow 3500 ms looping pulse on the logo glow, a repeating sonar ring, and visible tagline and loading dots.
5. WHEN `shouldExit` becomes `true`, THE SplashShell SHALL animate the whole splash to `opacity: 0` over 300 ms with `ease: easeIn`.

---

### Requirement 4: Graceful Rive Fallback

**User Story:** As a user, I want the splash screen to display correctly even when the Rive asset fails to load or is unavailable, so that I never see a blank or broken screen during startup.

#### Acceptance Criteria

1. WHEN `RiveAnimation.onError` fires, THE SplashScreen SHALL set `riveError` to `true` and render `FallbackSplash` in place of `RiveSplashCanvas` within the same React commit.
2. WHILE the Rive asset is loading, THE RiveSplashCanvas SHALL display `FallbackSplash` as the `fallback` prop of `RiveAnimation` so no blank frame is shown during the fetch.
3. IF `riveError` is `true`, THEN THE SplashScreen SHALL render `FallbackSplash` with the same `shouldExit` and `onExitComplete` props so the exit sequence completes normally.
4. THE FallbackSplash SHALL visually mirror the Rive artboard — ambient radial glow, logo spring-in with pulsing halo, three orbital dots, sonar ring, letter-by-letter app name, tagline, and wave loading dots.

---

### Requirement 5: Reduced-Motion Accessibility

**User Story:** As a user with vestibular or motion sensitivity, I want the splash screen to respect my OS-level "Reduce Motion" preference, so that I am not exposed to animations that could cause discomfort.

#### Acceptance Criteria

1. WHEN `prefers-reduced-motion` is `true`, THE SplashScreen SHALL set `useRive` to `false` before any Rive hook is called so the `.riv` file is never fetched.
2. WHEN `prefers-reduced-motion` is `true`, THE SplashScreen SHALL render `FallbackSplash` directly, which uses Framer Motion's native reduced-motion handling.
3. THE SplashScreen SHALL detect the reduced-motion preference using Framer Motion's `useReducedMotion()` hook with no new npm dependencies.

---

### Requirement 6: Exit Lifecycle — Exactly Once

**User Story:** As a developer, I want the splash exit callback to fire exactly once per lifecycle, so that the app never double-unmounts or misses the transition to the main UI.

#### Acceptance Criteria

1. WHEN `isInitializing` becomes `false`, THE SplashScreen SHALL set `shouldExit` to `true` after a 200 ms grace delay to allow at least one breathe cycle to complete.
2. THE SplashScreen SHALL treat `shouldExit` as a one-way flag — once set to `true` it SHALL never revert to `false`.
3. THE SplashShell SHALL call `onExitComplete` exactly once via its `onAnimationComplete` handler when the exit fade completes.
4. WHEN both the Rive exit timeline and the SplashShell exit fade complete simultaneously, THE SplashScreen SHALL call `onExitComplete` exactly once — not twice.

---

### Requirement 7: Non-Blocking Asset Loading

**User Story:** As a user, I want the splash screen to appear immediately on launch without waiting for the Rive asset to download, so that I see something on screen as fast as possible.

#### Acceptance Criteria

1. THE RiveSplashCanvas SHALL initiate the `splash.riv` fetch asynchronously after mount so the shell and fallback render synchronously on the first frame regardless of network speed.
2. WHILE the Rive asset is fetching, THE SplashScreen SHALL display `FallbackSplash` so the user always sees a visual during the load window.
3. THE SplashScreen SHALL not block the React render tree — `SplashShell` and its children SHALL be visible before the Rive asset resolves.

---

### Requirement 8: Safe-Area and Responsive Layout

**User Story:** As a user on iOS or Android, I want the splash screen to cover the full display including notch, status bar, and home indicator areas, so that the experience feels native and edge-to-edge.

#### Acceptance Criteria

1. THE SplashShell SHALL use `position: fixed; inset: 0` and `z-index: 9999` to cover the full viewport including notch and status bar areas on iOS and Android.
2. THE SplashShell SHALL apply the background colour `#050505` via inline style so it is present on the first synchronous render.
3. THE RiveSplashCanvas SHALL constrain the Rive canvas to `min(280px, 70vw)` × `min(280px, 70vw)` so it scales down on small screens without distortion.
4. THE FallbackSplash SHALL position the wave loading indicator with `padding-bottom: env(safe-area-inset-bottom, 20px)` so it clears the iOS home indicator.
5. WHILE running on Android with `StatusBar.setOverlaysWebView({ overlay: true })` active, THE SplashShell SHALL extend behind the status bar using the near-black background so status bar icons remain readable without additional styling.

---

### Requirement 9: Visual Design Fidelity

**User Story:** As a product stakeholder, I want the splash screen to express the "medical-grade calm" design language — precision, calm, trust, and minimalism — so that the app makes a strong first impression consistent with its health-focused brand.

#### Acceptance Criteria

1. THE SplashShell SHALL use background colour `#050505` as the full-screen background.
2. THE FallbackSplash SHALL use `#22c9cc` (teal-bright) for primary glow, ring strokes, and active orbital dots.
3. THE FallbackSplash SHALL use `#1a9ca0` (teal-mid) for secondary glow and the wave loading indicator.
4. THE FallbackSplash SHALL render the app name "Dawa · Lens" using the system-ui / `-apple-system` font stack at `clamp(1.9rem, 7.5vw, 2.55rem)`, weight 400, letter-spacing `0.05em`.
5. THE FallbackSplash SHALL render the tagline "Smart Medicine Reminder" in uppercase at `0.67rem`, weight 400, letter-spacing `0.26em`, colour `rgba(255,255,255,0.38)`.
6. THE FallbackSplash SHALL render three orbital dots at radius 58 px, dot size 3.5 px, completing one clockwise revolution every 7 seconds.

---

### Requirement 10: No New Dependencies

**User Story:** As a developer, I want the splash screen redesign to use only already-installed packages, so that the bundle size and dependency surface do not grow.

#### Acceptance Criteria

1. THE SplashScreen SHALL use only `@rive-app/react-canvas`, `framer-motion`, `react`, and `@capacitor/splash-screen` — all of which are already installed — with no new npm packages added.
2. THE SplashScreen SHALL use `useReducedMotion()` from the already-installed `framer-motion` package rather than a custom media-query hook.
3. THE RiveSplashCanvas SHALL use the existing `RiveAnimation` component rather than calling `useRive` directly, preserving the existing abstraction layer.
