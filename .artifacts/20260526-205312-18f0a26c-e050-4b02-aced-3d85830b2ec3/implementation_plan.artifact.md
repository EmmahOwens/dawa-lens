# Optimize Splash Screen for Native Feel and Smoothness

This plan aims to reduce the perceived loading time and make the splash screen transition feel "native" on Capacitor by synchronizing colors, speeding up animations, and optimizing the hiding logic.

## User Review Required

> [!NOTE]
> I am reducing the mandatory splash screen delay from 3.5 seconds to 1.5 seconds. This will make the app feel much faster, but will shorten the "boot animation" duration.

## Proposed Changes

### 1. Style Synchronization

#### [SplashScreen.tsx](file:///home/iammbayo/Documents/Projects/dawa-lens/src/components/SplashScreen.tsx)
- Update `BG` constant to `#050505` to match `capacitor.config.ts`.
- Simplify and speed up animations:
    - Reduce initial delays for orbital dots and logo.
    - Speed up the logo entrance and text assembly.
    - Remove or shorten "busy" animations like sparkles if they contribute to the "webby" feel.

### 2. Logic Optimization

#### [AppContext.tsx](file:///home/iammbayo/Documents/Projects/dawa-lens/src/contexts/AppContext.tsx)
- Reduce `minSplashTimePassed` timeout from `3500ms` to `1500ms`.

#### [main.tsx](file:///home/iammbayo/Documents/Projects/dawa-lens/src/main.tsx)
- Adjust the native splash screen hiding delay or remove it in favor of a more coordinated hide in `App.tsx` once the initial web frame is rendered.

## Verification Plan

### Manual Verification
- **Visual Inspection**: Check `SplashScreen.tsx` and `capacitor.config.ts` to ensure hex colors match.
- **Timing Check**: Verify the `setTimeout` in `AppContext.tsx` is reduced.
- **Animation Review**: Review the simplified `SplashScreen.tsx` code to ensure it's less "busy".
- **Transition Logic**: Verify `main.tsx` or `App.tsx` has logic to hide the native splash screen smoothly.
