/**
 * wellnessPulseQuotes.ts
 *
 * A curated collection of 75 uplifting, health-focused quotes for the
 * Wellness Pulse banner on the Home dashboard.
 *
 * Designed to cycle sequentially once every time the app is launched or opened.
 * When the list completes, the cycle seamlessly restarts from the beginning.
 */

export const WELLNESS_PULSE_STORAGE_KEY = "dawa_wellness_pulse_index";
export const WELLNESS_PULSE_SESSION_INDEX_KEY = "dawa_wellness_pulse_session_index";

export const WELLNESS_PULSE_QUOTES: readonly string[] = [
  "Consistency is your greatest superpower, {name}.",
  "Every small step toward your health counts today, {name}.",
  "Your future self will thank you for taking care of yourself today, {name}.",
  "Wellness is a daily journey of small, positive habits, {name}.",
  "Prioritizing your health is the highest form of self-care, {name}.",
  "Small daily improvements over time lead to remarkable results, {name}.",
  "You are doing an incredible job taking care of your health, {name}.",
  "Stay mindful, stay consistent, and keep nourishing your life, {name}.",
  "Health is not a destination, it is a daily commitment, {name}.",
  "Every dose and every log brings you closer to optimal vitality, {name}.",
  "Take a breath and celebrate every step of your wellness journey, {name}.",
  "Building healthy habits is an investment in your best tomorrow, {name}.",
  "Listen to your body, honour your routine, and keep shining, {name}.",
  "Great achievements are built on small, consistent choices, {name}.",
  "Your dedication to your well-being inspires everyone around you, {name}.",
  "Nurture your mind and body with patience and positivity today, {name}.",
  "Progress over perfection: every healthy choice matters, {name}.",
  "You are stronger, healthier, and more resilient every single day, {name}.",
  "Self-care is never selfish—it is your foundation, {name}.",
  "Keep up the momentum, {name}, your health journey is worth every effort.",
  "Rest, recover, and keep moving forward with confidence, {name}.",
  "A healthy routine today is the best gift for your future, {name}.",
  "Honour your health journey with gentleness and purpose today, {name}.",
  "Each healthy choice you make is an act of self-respect, {name}.",
  "True vitality begins with the small commitments you keep to yourself, {name}.",
  "Trust the process, {name}: consistent habits create enduring strength.",
  "Celebrate your progress today, no matter how small it may seem, {name}.",
  "Your body hears everything your mind says—treat it with kindness, {name}.",
  "Take pride in prioritizing your health every single morning, {name}.",
  "One day at a time, one habit at a time, you are thriving, {name}.",
  "Your wellness is your greatest wealth; cherish it today, {name}.",
  "Patience and persistence are the true keystones of vitality, {name}.",
  "Every healthy choice brings peace of mind and lasting energy, {name}.",
  "Show up for yourself today just as you would for someone you love, {name}.",
  "A calm mind and a steady routine nourish your body's healing, {name}.",
  "Every small action you take today creates a brighter tomorrow, {name}.",
  "Strength does not come from what you can do, but overcoming what you once thought you could not, {name}.",
  "Feed your body good habits, feed your mind calm thoughts, {name}.",
  "Your health is an ongoing story of resilience and care, {name}.",
  "Remember why you started, and keep walking this path with pride, {name}.",
  "Good health is built in the quiet moments of daily dedication, {name}.",
  "Breathe deeply, drink water, and acknowledge your steady progress, {name}.",
  "Your commitment to your wellness routine is truly inspiring, {name}.",
  "Balance is not something you find, it is something you create, {name}.",
  "Be patient with yourself; lasting healing takes steady time, {name}.",
  "Each morning offers a fresh opportunity to nourish your well-being, {name}.",
  "Your body is capable of amazing healing when supported with care, {name}.",
  "Step by step, habit by habit, you are cultivating vibrant health, {name}.",
  "Kindness toward yourself is the root of all true healing, {name}.",
  "Keep your habits steady, your spirit light, and your head held high, {name}.",
  "Today is another victory in your lifelong journey of health, {name}.",
  "Taking your medications as scheduled is a pledge to your future, {name}.",
  "Radiate health and positivity from within, {name}.",
  "Give your body the care, nourishment, and respect it deserves today, {name}.",
  "Small, daily steps beat occasional giant leaps every single time, {name}.",
  "Stay focused on your wellness goals; you are closer than you think, {name}.",
  "Every positive routine you maintain protects your peace and strength, {name}.",
  "Your health journey is uniquely yours—embrace every milestone, {name}.",
  "Consistency today builds the vitality you will enjoy for years, {name}.",
  "Pause, breathe, and appreciate how far you have already come, {name}.",
  "Caring for your body is an investment that always pays dividends, {name}.",
  "Let your daily routine be your anchor and your source of calm, {name}.",
  "You possess the inner resilience to meet whatever today brings, {name}.",
  "Every healthy habit you build forms an unbreakable shield of vitality, {name}.",
  "Cherish the vitality of today and nurture the energy of tomorrow, {name}.",
  "A mindful routine turns ordinary days into extraordinary health, {name}.",
  "Be proud of the discipline and love you pour into your well-being, {name}.",
  "Healing is not linear, but consistent care always moves you forward, {name}.",
  "Your health is your foundation; keep building it with care, {name}.",
  "Stand tall, {name}: your dedication to your health is making a real difference.",
  "Every log and every dose is a vote for the person you want to become, {name}.",
  "Gentle progress is still progress; keep moving ahead with grace, {name}.",
  "Anchor your day with healthy choices, and vitality will follow, {name}.",
  "Your well-being matters, your life matters, and you are doing great, {name}.",
  "A vibrant life is woven from the threads of daily self-care, {name}."
];

/**
 * Formats a wellness quote by replacing the `{name}` placeholder with
 * the user's name or a fallback greeting ("friend").
 */
export function formatWellnessPulseQuote(template: string, name?: string): string {
  const cleanName = name?.trim() ? name.trim() : "friend";
  return template.replace(/\{name\}/g, cleanName);
}

/**
 * Returns the current session quote or advances the persistent cycle if
 * this is a new app launch/open.
 *
 * - In the same app session, it retrieves the quote assigned on launch so that
 *   navigating between pages never abruptly changes the quote.
 * - When opened in a new session (or cold launch), it picks the next quote
 *   in line, increments the index (wrapping at the end of the array), and
 *   persists it to localStorage.
 */
export function getNextWellnessPulseQuote(userName?: string): string {
  const totalQuotes = WELLNESS_PULSE_QUOTES.length;
  if (totalQuotes === 0) {
    return "Wellness is a daily journey of small, positive habits.";
  }

  try {
    // 1. Check if a quote index has already been assigned to this active session
    const sessionIndexRaw = sessionStorage.getItem(WELLNESS_PULSE_SESSION_INDEX_KEY);

    if (sessionIndexRaw !== null) {
      const sessionIndex = parseInt(sessionIndexRaw, 10);
      if (!Number.isNaN(sessionIndex) && sessionIndex >= 0 && sessionIndex < totalQuotes) {
        return formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[sessionIndex], userName);
      }
    }

    // 2. Fresh launch / new session: Read current persistent index
    const storedIndexRaw = localStorage.getItem(WELLNESS_PULSE_STORAGE_KEY);
    let currentIndex = storedIndexRaw ? parseInt(storedIndexRaw, 10) : 0;

    if (Number.isNaN(currentIndex) || currentIndex < 0 || currentIndex >= totalQuotes) {
      currentIndex = 0;
    }

    // 3. Advance persistent index for next launch with modulo wrap-around
    const nextIndex = (currentIndex + 1) % totalQuotes;
    localStorage.setItem(WELLNESS_PULSE_STORAGE_KEY, nextIndex.toString());

    // 4. Save assigned index for the current session
    sessionStorage.setItem(WELLNESS_PULSE_SESSION_INDEX_KEY, currentIndex.toString());

    return formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[currentIndex], userName);
  } catch (err) {
    console.warn("[WellnessPulse] Storage access error, falling back:", err);
    return formatWellnessPulseQuote(WELLNESS_PULSE_QUOTES[0], userName);
  }
}

/**
 * Force advance to the next quote in cycle (useful for testing or manual triggers).
 */
export function advanceWellnessPulseQuote(userName?: string): string {
  try {
    sessionStorage.removeItem(WELLNESS_PULSE_SESSION_INDEX_KEY);
  } catch {
    // ignore
  }
  return getNextWellnessPulseQuote(userName);
}
