# Optimized Splash Screen for Native Feel

I have optimized the splash screen to feel more native and load significantly faster by reducing mandatory delays and simplifying animations.

## Changes

### 1. Speed and Responsiveness
- Reduced the mandatory splash screen delay in `AppContext.tsx` from **3500ms** to **800ms**.
- Compressed the entire animation timeline in `SplashScreen.tsx` to fit within this new window.
- The app now becomes interactive nearly 3 seconds sooner than before.

### 2. Native Look & Feel
- **Color Matching**: Synchronized the background color in `SplashScreen.tsx` to `#050505`, matching the `capacitor.config.ts` exactly to eliminate any "flash" during the transition.
- **Smooth Hiding**: Updated `main.tsx` to hide the native Capacitor splash screen immediately. Since the web-based splash screen loads instantly with the same background and logo, this creates a seamless "handover" that feels like a single native process.
- **Simplified Animations**: Removed complex "spring" physics and long staggered delays. The logo now appears quickly with a smooth fade and scale, and the text assembles rapidly.

### 3. Reduced "Webby" Visuals
- Shortened the "blur to sharp" transition for text.
- Reduced the delay for orbital dots and the loading indicator to appear almost instantly.

## Verification Summary
- Verified background colors match across `SplashScreen.tsx` and `capacitor.config.ts`.
- Verified that the `minSplashTimePassed` timeout is correctly reduced.
- Confirmed that `main.tsx` logic avoids redundant delays in hiding the native splash screen.
