# Implementation Plan: Splash Screen Redesign

## Overview

Refactor `SplashScreen.tsx` from a 300-line monolith into a thin orchestrator (~60 lines) and extract its visual concerns into focused sub-components under `src/components/splash/`. Wire in a `RiveSplashCanvas` that drives the existing `RiveAnimation` wrapper with `SplashSM` state machine inputs, and a `FallbackSplash` that mirrors the current visual using only Framer Motion. A shared `SplashShell` owns the fixed full-screen container and the authoritative exit fade. No changes to `App.tsx`, no new npm dependencies.

---

## Tasks

- [ ] 1. Extract `OrbitalDot` and `SonarRing` into standalone files
  - [ ] 1.1 Create `src/components/splash/OrbitalDot.tsx`
    - Copy the `OrbitalDotProps` interface and `OrbitalDot` component verbatim from `SplashScreen.tsx` — no logic changes
    - Export as named export `OrbitalDot`
    - _Requirements: 1.2, 1.3_

  - [ ] 1.2 Create `src/components/splash/SonarRing.tsx`
    - Copy the `SonarRing` component verbatim from `SplashScreen.tsx` — no logic changes
    - Export as named export `SonarRing`
    - _Requirements: 1.2, 1.3_

- [ ] 2. Implement `SplashShell`
  - [ ] 2.1 Create `src/components/splash/SplashShell.tsx`
    - Define `SplashShellProps`: `children`, `shouldExit: boolean`, `onExitComplete?: () => void`
    - Render a `motion.div` with `className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"` and `style={{ background: '#050505' }}` as an inline style (synchronous first-frame paint — Property 1)
    - `animate={shouldExit ? { opacity: 0 } : { opacity: 1 }}` with `transition={{ duration: 0.3, ease: 'easeIn' }}`
    - `onAnimationComplete`: call `onExitComplete?.()` only when `shouldExit` is `true` — this is the single callback source (Property 4)
    - _Requirements: 1.1, 3.1, 3.5, 6.3, 8.1, 8.2, 9.1_

  - [ ]* 2.2 Write unit tests for `SplashShell`
    - Test: renders children correctly
    - Test: applies `#050505` background via inline style on first render
    - Test: calls `onExitComplete` when `shouldExit=true` and animation completes
    - Test: does NOT call `onExitComplete` when `shouldExit=false`
    - _Requirements: 3.1, 6.3_

- [ ] 3. Implement `FallbackSplash`
  - [ ] 3.1 Create `src/components/splash/FallbackSplash.tsx`
    - Define `FallbackSplashProps`: `shouldExit: boolean`, `onExitComplete?: () => void`
    - Import `OrbitalDot` from `./OrbitalDot` and `SonarRing` from `./SonarRing`
    - Replicate the full visual from the current `SplashScreen.tsx` body:
      - Ambient radial glow (CSS `radial-gradient`, Framer Motion fade-in over 3 s)
      - Logo spring-in (`scale: 0.7→1`, `opacity: 0→1`, `duration: 0.4`, `delay: 0.1`) with pulsing halo (`radial-gradient`, `blur: 10px`)
      - Three `OrbitalDot` instances at `radius=58`, `dotSize=3.5`, `duration=7`, clockwise, `startAngle` 0°/120°/240°
      - One `SonarRing` at `baseSize=90`, `delay=1.0`
      - Faint orbit guide circle (border `rgba(26,156,160,0.15)`)
      - Letter-by-letter "Dawa · Lens" reveal using staggered `motion.span` variants
      - Tagline "Smart Medicine Reminder" fade-in
      - Wave `LoadingDots` (4 dots, `y: [0,-8,0]`, stagger `0.2 s`)
    - Phase timings via `useEffect` + `setTimeout`: orbits at 100 ms, text at 400 ms, loader at 600 ms, tagline at 800 ms
    - When `shouldExit` becomes `true`, animate the root wrapper to `{ opacity: 0, scale: 1.04 }` over 300 ms then call `onExitComplete`
    - Use `useEffect` on `shouldExit` with a 300 ms `setTimeout` to call `onExitComplete?.()` (mirrors shell timing)
    - Apply `padding-bottom: env(safe-area-inset-bottom, 20px)` to the loading indicator container
    - _Requirements: 1.1, 3.2, 3.3, 3.4, 4.4, 8.4, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ]* 3.2 Write unit tests for `FallbackSplash`
    - Test: renders logo image with `src="/logo.png"`
    - Test: renders app name "Dawa" and "Lens" text
    - Test: calls `onExitComplete` after ~300 ms when `shouldExit=true`
    - Test: does NOT call `onExitComplete` when `shouldExit=false`
    - _Requirements: 4.4, 6.3_

- [ ] 4. Checkpoint — sub-components ready
  - Ensure all tests pass for `SplashShell` and `FallbackSplash`. Ask the user if questions arise.

- [ ] 5. Implement `RiveSplashCanvas`
  - [ ] 5.1 Create `src/components/splash/RiveSplashCanvas.tsx`
    - Define `RiveSplashCanvasProps`: `onRiveReady?: () => void`, `onRiveError?: () => void`, `shouldExit: boolean`, `onExitComplete?: () => void`
    - Manage local state `{ start: boolean, exit: boolean }` for Rive inputs
    - `useEffect([], [])`: `setTimeout(() => setInputs(i => ({ ...i, start: true })), 50)` — triggers Intro timeline within 50 ms of mount (Requirement 2.2)
    - `useEffect([shouldExit])`: when `shouldExit` is `true`, set `exit: true` in inputs (Requirement 2.3)
    - `useEffect([shouldExit])`: when `shouldExit` is `true`, `setTimeout(() => onExitComplete?.(), 350)` — fires after the 300 ms exit timeline (Property 4)
    - Render `<RiveAnimation>` with:
      - `src="/assets/rive/splash.riv"`
      - `artboard="SplashArtboard"`
      - `stateMachine="SplashSM"`
      - `inputs={inputs}`
      - `onLoad={onRiveReady}`
      - `onError={onRiveError}`
      - `fit={Fit.Contain}`, `alignment={Alignment.Center}`
      - `className` constraining canvas to `min(280px, 70vw)` × `min(280px, 70vw)` (Requirement 2.5)
      - `fallback={<FallbackSplash shouldExit={shouldExit} onExitComplete={onExitComplete} />}` — covers the loading window (Requirement 4.2, Property 2)
    - Import `Fit`, `Alignment` from `@rive-app/react-canvas`
    - Import `RiveAnimation` from `../rive/RiveAnimation`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.2, 7.1, 10.3_

  - [ ]* 5.2 Write unit tests for `RiveSplashCanvas`
    - Test: renders `FallbackSplash` as fallback while Rive loads (mock `RiveAnimation`)
    - Test: calls `onRiveReady` when `RiveAnimation.onLoad` fires
    - Test: calls `onRiveError` when `RiveAnimation.onError` fires
    - Test: passes `start: true` in inputs within 50 ms of mount
    - Test: passes `exit: true` in inputs when `shouldExit` becomes `true`
    - _Requirements: 2.2, 2.3, 2.4, 4.2_

  - [ ]* 5.3 Write property test for `RiveSplashCanvas` — exit fires exactly once
    - **Property 4: Exit fires exactly once**
    - For any sequence of `shouldExit` transitions (`false → true`), `onExitComplete` is called exactly once regardless of re-renders
    - Use `fast-check` to generate arbitrary re-render sequences with `shouldExit=true`
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [ ] 6. Refactor `SplashScreen.tsx` into the orchestrator
  - [ ] 6.1 Rewrite `src/components/SplashScreen.tsx` as a thin orchestrator (~60 lines)
    - Define `SplashScreenProps`: `onExitComplete?: () => void`
    - Define `SplashState`: `{ riveLoaded: boolean; riveError: boolean; shouldExit: boolean }`
    - Read `isInitializing` from `useApp()` and `prefersReducedMotion` from `useReducedMotion()` (framer-motion)
    - `useEffect([isInitializing])`: when `isInitializing` becomes `false` and `shouldExit` is still `false`, set `shouldExit: true` after a 200 ms `setTimeout` grace delay (Requirement 6.1)
    - Derive `useRive = !state.riveError && !prefersReducedMotion` (Requirements 5.1, 5.2)
    - Render `<SplashShell shouldExit={state.shouldExit} onExitComplete={onExitComplete}>` wrapping either `<RiveSplashCanvas>` or `<FallbackSplash>` based on `useRive`
    - Pass `onRiveReady`, `onRiveError`, `shouldExit`, `onExitComplete` to `RiveSplashCanvas`
    - Pass `shouldExit`, `onExitComplete` to `FallbackSplash`
    - Remove all inline component definitions (`OrbitalDot`, `SonarRing`, `LoadingDots`) — they now live in `src/components/splash/`
    - Preserve the default export `SplashScreen` so `App.tsx` import is unchanged
    - _Requirements: 1.1, 1.4, 5.1, 5.2, 5.3, 6.1, 6.2, 10.1, 10.2_

  - [ ]* 6.2 Write unit tests for `SplashScreen` orchestrator
    - Test: renders `FallbackSplash` when `prefersReducedMotion=true` (mock `useReducedMotion`)
    - Test: renders `FallbackSplash` when `riveError=true`
    - Test: renders `RiveSplashCanvas` when `prefersReducedMotion=false` and no error
    - Test: sets `shouldExit=true` within 300 ms of `isInitializing` becoming `false`
    - Test: `shouldExit` never reverts to `false` once set
    - _Requirements: 5.1, 5.2, 6.1, 6.2_

  - [ ]* 6.3 Write property test for `SplashScreen` — `onExitComplete` fires exactly once
    - **Property 4: Exit fires exactly once**
    - For any sequence of `isInitializing` values `[true, ..., false]`, `onExitComplete` is called exactly once across the full lifecycle
    - Use `fast-check` to generate arbitrary `isInitializing` flip timings
    - **Validates: Requirements 6.3, 6.4**

  - [ ]* 6.4 Write property test for `SplashScreen` — no blank frame on mount
    - **Property 1: No blank frame on mount**
    - For any render of `SplashScreen`, the `SplashShell` element with `background: #050505` is present in the DOM on the first synchronous render
    - Use `fast-check` to generate arbitrary prop combinations
    - **Validates: Requirements 3.1, 8.2**

  - [ ]* 6.5 Write property test for `SplashScreen` — fallback always visible on Rive error
    - **Property 2: Fallback always visible on Rive error**
    - For any render where `riveError` becomes `true`, `FallbackSplash` is present in the DOM within the same React commit — no moment where neither Rive nor fallback is visible
    - Use `fast-check` to generate arbitrary error timing sequences
    - **Validates: Requirements 4.1, 4.3_

  - [ ]* 6.6 Write property test for `SplashScreen` — reduced-motion skips Rive entirely
    - **Property 3: Reduced-motion path skips Rive entirely**
    - When `prefersReducedMotion=true`, `RiveSplashCanvas` is never rendered and no `src="/assets/rive/splash.riv"` fetch is initiated
    - Use `fast-check` to generate arbitrary prop combinations with `prefersReducedMotion=true`
    - **Validates: Requirements 5.1, 5.2, 5.3_

- [ ] 7. Final checkpoint — full integration
  - Ensure all tests pass. Verify `App.tsx` is unchanged and `<SplashScreen />` renders without errors. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- `OrbitalDot` and `SonarRing` are pure extractions — zero logic changes, just new file locations
- `SplashShell.onAnimationComplete` is the single source of truth for `onExitComplete` — prevents double-firing even if Rive and shell complete simultaneously
- The `fallback` prop on `RiveAnimation` covers the Rive fetch window so no blank frame is ever shown
- `prefers-reduced-motion` is detected via `useReducedMotion()` from the already-installed `framer-motion` — no new dependencies
- Property tests use `fast-check` which is already installed in the project
- The `splash.riv` asset must be built separately in the Rive editor per the artboard spec in `design.md` and placed at `public/assets/rive/splash.riv`

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "6.4", "6.5", "6.6"] }
  ]
}
```
