/**
 * quotesService.ts — Engagement notifications beyond medication reminders.
 * All notifications use both Capacitor LocalNotifications (allowWhileIdle) AND
 * NativeAlarm (AlarmManager.setExactAndAllowWhileIdle) for offline reliability.
 */

import {
  LocalNotifications,
  LocalNotificationSchema,
} from "@capacitor/local-notifications";
import { NativeAlarm, AlarmNotification } from "@/plugins/nativeAlarm";
import { Capacitor } from "@capacitor/core";
import { DoseLog, Reminder, WellnessLog } from "@/contexts/AppContext";
import {
  addDays,
  startOfDay,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  isAfter,
  subDays,
  getDay,
  parseISO,
} from "date-fns";

// ─── Channel IDs ────────────────────────────────────────────────────────────
export const CHANNEL_QUOTES    = "dawa_quotes_v2";
export const CHANNEL_WELLNESS  = "dawa_wellness_v2";
export const CHANNEL_HYDRATION = "dawa_hydration_v2";
export const CHANNEL_STREAKS   = "dawa_streaks_v2";

// ─── localStorage keys ───────────────────────────────────────────────────────
const QUOTE_DAY_INDEX_KEY           = "dawa_quote_day_index";
const QUOTE_LAST_SCHEDULED_DATE_KEY = "dawa_quote_last_scheduled_date";
const ENGAGEMENT_LOCAL_IDS_KEY      = "dawa_engagement_local_ids";

// ─── Utility ─────────────────────────────────────────────────────────────────
const stringToHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  // Clamp within positive 32-bit signed int range [1, 2147483646]
  const val = Math.abs(hash % 2147483647);
  return val === 0 ? 1 : val;
};

function setTime(date: Date, h: number, m: number, s = 0, ms = 0): Date {
  let d = setHours(new Date(date), h);
  d = setMinutes(d, m);
  d = setSeconds(d, s);
  d = setMilliseconds(d, ms);
  return d;
}

// ─── Create Android notification channels ────────────────────────────────────
export async function createEngagementChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (Capacitor.getPlatform() !== "android") return;
  try {
    await LocalNotifications.createChannel({ id: CHANNEL_QUOTES,    name: "Daily Health Quotes",       description: "Motivational health quotes to keep you inspired",   importance: 3, vibration: false, sound: "default" });
    await LocalNotifications.createChannel({ id: CHANNEL_WELLNESS,  name: "Wellness Reminders",        description: "Evening check-ins and wellness log nudges",         importance: 3, vibration: false, sound: "default" });
    await LocalNotifications.createChannel({ id: CHANNEL_HYDRATION, name: "Hydration Reminders",       description: "Stay hydrated throughout the day",                  importance: 2, vibration: false, sound: "default" });
    await LocalNotifications.createChannel({ id: CHANNEL_STREAKS,   name: "Achievements & Streaks",    description: "Celebrate your medication adherence milestones",    importance: 4, vibration: true,  sound: "default" });
  } catch (err) {
    console.warn("[quotesService] Failed to create engagement channels:", err);
  }
}

// ─── Cancel previously scheduled engagement notifications ────────────────────
async function cancelPreviousEngagementNotifs(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const raw = localStorage.getItem(ENGAGEMENT_LOCAL_IDS_KEY);
    if (!raw) return;
    const ids: number[] = JSON.parse(raw);
    if (ids.length > 0) {
      await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
    }
  } catch (err) {
    console.warn("[quotesService] Failed to cancel old engagement notifs:", err);
  }
}

function saveEngagementIds(ids: number[]): void {
  try { localStorage.setItem(ENGAGEMENT_LOCAL_IDS_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

async function scheduleNotif(
  localNotifs: LocalNotificationSchema[],
  alarmNotifs: AlarmNotification[]
): Promise<void> {
  if (localNotifs.length > 0) {
    try {
      await LocalNotifications.schedule({ notifications: localNotifs });
    } catch (e) {
      console.warn("[quotesService] LocalNotifications.schedule failed (non-fatal):", e);
    }
  }
  if (alarmNotifs.length > 0) {
    try {
      await NativeAlarm.scheduleAlarms({ notifications: alarmNotifs });
    } catch (e) {
      console.warn("[quotesService] NativeAlarm failed (non-fatal):", e);
    }
  }
}


// ─── 1000 Health Quotes ──────────────────────────────────────────────────────

// Category A: Medication Adherence (200 quotes)
const ADHERENCE_QUOTES: string[] = [
  "💊 Taking your medication on time is one of the most powerful things you can do for your health.",
  "💊 Every dose counts. Stay consistent.",
  "🩺 Your treatment works best when you stick to the schedule.",
  "💊 Medicine works best when taken as prescribed — trust the process.",
  "📅 Small habits, taken daily, lead to big health outcomes.",
  "💊 Consistency with your medication is a gift you give yourself.",
  "✅ You showed up for your health today. That takes courage.",
  "💊 One dose at a time — you are building a healthier future.",
  "💊 Your body is fighting for you. Help it with every dose.",
  "📅 Adherence is not just a habit — it is an act of self-love.",
  "💊 Taking your medicine today is investing in tomorrow's energy.",
  "📆 Healing is a daily commitment, and you are showing up.",
  "💊 The most important thing you can do right now? Take your next dose.",
  "🎯 Your health journey is made of thousands of small, consistent decisions.",
  "💊 Missing a dose is an accident. Learning from it is wisdom.",
  "💊 Your future self will thank you for every pill taken on time.",
  "💊 Treatment is a partnership between you and your medicine.",
  "🔒 Discipline in health is the highest form of self-respect.",
  "💊 The road to recovery is paved with consistent medication.",
  "💊 You are not just taking medicine — you are taking control.",
  "💊 Each dose is a vote for the healthier version of yourself.",
  "💊 When life gets busy, your health comes first. Take your medicine.",
  "💊 A good routine includes your medication. Always.",
  "💊 Never let a skipped dose become a skipped week.",
  "💊 Your healing is happening, one dose at a time.",
  "😊 Stay on track today so you can enjoy tomorrow fully.",
  "🎯 The most powerful health tool you have is your adherence.",
  "💊 Medications work when you let them — take them consistently.",
  "📋 Your doctor prescribed it for a reason. Trust the plan.",
  "💊 Health is built in small daily actions — your medication is one of them.",
  "🎯 Progress in healing is rarely loud — it is quiet, daily consistency.",
  "💪 You are stronger than any side effect. Keep going.",
  "💊 Your body remembers when you take care of it.",
  "💊 Each time you take your dose, you are choosing yourself.",
  "💊 The gap between feeling better and stopping early can be dangerous — finish the course.",
  "💊 Taking medication does not make you weak. It makes you wise.",
  "🎯 Your health goals are within reach when you stay consistent.",
  "💊 Think of your medication as a daily conversation with your health.",
  "💊 A missed dose does not mean failure — it means refocus.",
  "📋 Your prescription is a roadmap. Follow it faithfully.",
  "💊 When you take your medication, you are showing up for everyone who loves you.",
  "🎯 Adherence is not about perfection — it is about persistence.",
  "💊 You have come too far to skip a dose now. Keep going.",
  "📆 Your health is your greatest asset. Protect it daily.",
  "💊 Set an alarm, take your dose, repeat. That is the formula.",
  "🎯 Consistency beats intensity every time in managing your health.",
  "💊 Medication does not work if you do not take it. Simple as that.",
  "💊 Every day you take your dose is a day you invest in longevity.",
  "💊 Do not wait to feel sick to remember to take your medicine.",
  "🩺 Your body deserves the full course of treatment you started.",
  "💊 Taking medicine faithfully is a sign of strength, not weakness.",
  "✨ Be the patient your future doctor brags about.",
  "💊 A skipped dose today can mean a setback tomorrow.",
  "🔒 Your commitment to your health inspires those around you.",
  "💊 Medication adherence is the silent superpower of recovery.",
  "💊 Think long-term: every dose brings you closer to your health goals.",
  "📅 Health routines do not have weekends off. Stay consistent.",
  "💊 Your medicine is doing its job. Do yours by taking it.",
  "💊 Success in treatment looks like taking your pills, even when you feel fine.",
  "💊 The best time to take your medication? Right now.",
  "💊 Feeling better is a sign it is working — not a sign to stop.",
  "🌿 Your health is worth more than any excuse to skip.",
  "💊 Keep a water bottle next to your medication. Make it easy.",
  "💊 If you would not miss a meal, do not miss your medication.",
  "💊 Build your medication into a ritual — make it something you look forward to.",
  "💊 There is no shortcut to healing. Take your dose today.",
  "💊 Your consistency with medication is a form of bravery.",
  "💊 Every time you take your medicine, you are rewriting your health story.",
  "💊 A great day starts with taking your morning dose.",
  "💊 Honor your body today — take your medication.",
  "⏰ Your care team trusts you to stay on schedule. Show them you can.",
  "💊 Medication is just one part of your healing — a crucial part.",
  "💊 When you stick to your plan, your body sticks up for you.",
  "📲 Being forgetful is human. Setting a reminder is wisdom.",
  "🎯 Your health is not a convenience — protect it with consistency.",
  "💊 Take your dose, no matter how busy the day gets.",
  "💊 Your medication schedule is a promise to your future self.",
  "💊 If your medication could speak, it would say: trust me.",
  "💊 Do not break the chain — another dose taken means another day closer.",
  "💊 Healing is not linear, but your dose schedule should be.",
  "🩺 You took the hardest step by starting treatment. Keep going.",
  "💊 The medication works quietly in the background — let it.",
  "💊 Missing one dose raises a red flag. Missing two raises a wall.",
  "💊 Your body is resilient, but it needs your help. Take your medicine.",
  "📆 Recovery is not a destination — it is a daily practice.",
  "💊 Medication adherence is the most underrated health habit.",
  "🌿 You are not just surviving — you are managing your health like a pro.",
  "💊 Every dose taken is a win. Do not forget to celebrate that.",
  "🩺 The strength of your treatment lies in your daily commitment.",
  "💊 The dose you skip today might be the healing you miss tomorrow.",
  "💊 You are your own best health advocate. Take your medicine.",
  "🌿 Your health team is rooting for you. Stay on track.",
  "💊 The quiet heroism of managing a chronic condition: taking your medicine.",
  "💊 Your medication gives you the chance to live fully. Use it.",
  "💊 Regular medication is not a burden — it is a gift to yourself.",
  "💊 Routine medication management is one of the highest forms of self-care.",
  "💊 The pill is small. The impact is enormous. Take it.",
  "🩺 Stay the course — your treatment is working.",
  "🎯 Your health journey is uniquely yours — honor it with consistency.",
  "📅 Good health is assembled one good habit at a time.",
  "💊 The foundation of your health plan is your daily medication.",
  "💊 You are not defined by your condition — you are defined by how you manage it.",
  "💊 There is power in the small act of taking your medicine.",
  "⏰ Do not let a busy schedule come between you and your health.",
  "💊 Your dose today is your down payment on tomorrow's vitality.",
  "💊 Medication adherence: the habit that changes everything.",
  "💊 Every dose is a vote of confidence in your own healing.",
  "🌿 Your health deserves the same attention as your work and relationships.",
  "🏆 Treating your body right means following through on its needs.",
  "💊 Skipping your dose is not saving time — it is borrowing trouble.",
  "📆 Health is not an accident. It is a daily intention.",
  "💊 When you commit to your medication, you commit to your life.",
  "💊 Be consistent. Be patient. Let the medicine do its work.",
  "📅 The smallest daily habits have the biggest health impact over time.",
  "💊 Do not underestimate the power of a single dose taken faithfully.",
  "📋 Your prescription is personalized just for you. Respect it.",
  "💊 Health is the canvas. Your medication is part of the brushwork.",
  "💊 Your medication is your silent partner in health — keep it close.",
  "💊 You did not start this journey to quit. Keep taking your dose.",
  "🎯 Good adherence is good stewardship of your own health.",
  "💊 Set your reminder, take your dose, repeat. Every day.",
  "💊 Healing requires patience and persistence. Take your medicine.",
  "💊 Your body is on your side. Support it with your medication.",
  "💊 You deserve to feel your best — and your medication helps you get there.",
  "🌿 There is dignity in doing what your health requires.",
  "💊 Managing your medication well is managing your life well.",
  "💊 Your commitment to medication is your commitment to yourself.",
  "💊 The most loving thing you can do today? Take your dose.",
  "💊 You are building a healthier future with every pill you take.",
  "💊 Strength looks like this: taking your medicine every single day.",
  "💊 Health is a daily practice. Start by taking your medication.",
  "🫂 Your body is working hard for you. Give it the support it needs.",
  "💊 When in doubt, take your dose. Consistency is always right.",
  "💊 Do not make your body wait for what it needs. Take your medicine.",
  "💊 A health-conscious person takes their medication on time.",
  "💊 Medication adherence: the quiet revolution in your health.",
  "💊 Today's dose is a promise to yourself that tomorrow will be better.",
  "💊 Your healing is worth every alarm, every reminder, every dose.",
  "💊 Trust the process. Take the pill. Repeat.",
  "💊 Your health goals are built on daily medication discipline.",
  "💊 One dose at a time: the healthiest formula in the world.",
  "💊 Taking your medication is the most direct route to feeling better.",
  "🎯 Your body speaks in symptoms — silence them with consistency.",
  "💊 Today is a good day to take your medicine. So is tomorrow.",
  "📋 Your prescription is a tool. Use it well.",
  "💊 Building health requires tools, habits, and yes — medication.",
  "💊 Your consistency with medication is a superpower.",
  "💊 Health is your most important project. Fund it with your medication.",
  "💊 Healing happens quietly, day by day, dose by dose.",
  "💊 Take your medicine and take pride in caring for yourself.",
  "💊 Your daily dose is proof of your daily commitment to yourself.",
  "💊 There is no version of your best self that skips medication.",
  "💊 Health is not optional. Neither is taking your medicine.",
  "📆 You have chosen health. Now show up for it every day.",
  "💊 One dose closer to your best health — that is today.",
  "📋 Taking your prescription seriously means taking your life seriously.",
  "📲 Do not wait for symptoms to remind you. Reminders are for that.",
  "💊 The best wellness routine includes medication. Every day.",
  "💊 Let your medication log be a source of pride, not guilt.",
  "💊 Your streaks matter. Keep them going with every dose.",
  "💊 Medication is part of your toolbox for life — use it well.",
  "💊 Regular doses, regular health. It is that straightforward.",
  "🌿 Your health story is still being written. Make it a good one.",
  "💊 Even on good days, take your dose. Especially on good days.",
  "💊 Discipline in medication management creates freedom in life.",
  "💊 Your future is worth taking your medicine today for.",
  "🎯 Your adherence speaks louder than your symptoms.",
  "💊 Health mastery begins with the habit of consistent medication.",
  "💊 Every dose taken in faith is a deposit in your health account.",
  "💊 Your medication schedule is non-negotiable — treat it that way.",
  "💊 The world needs you healthy. Take your dose.",
  "💊 You are not just taking pills. You are taking charge.",
  "💊 The power of consistent medication is cumulative — do not break the chain.",
  "🩺 Honor your treatment. Honor yourself.",
  "💊 Your medication time is sacred. Protect it.",
  "💊 Good health is simple: sleep, move, eat well, take your medicine.",
  "💊 Never underestimate the cumulative power of taking your dose daily.",
  "💊 The most reliable shortcut to wellness? Your medication, on schedule.",
  "💊 Do not wait to run out to know it is important. Take it now.",
  "📅 Your health commitment shows up every morning in your routine.",
  "💊 Take your medication first. Everything else can wait a moment.",
  "💊 Your dedication to your medication is a form of self-mastery.",
  "📲 A reminder gone off means your body is waiting. Answer the call.",
  "💊 Every dose is a deposit. Every skip is a withdrawal. Stay solvent.",
  "💊 You are your own best medicine manager. Stay sharp.",
  "💊 The discipline of daily medication creates the freedom of good health.",
  "💊 Your pills are small but their cumulative effect is mighty.",
  "💊 Consistent medication use is the most evidence-backed health habit.",
  "🔒 You have committed to your health. Follow through every single day.",
];

// Category B: Health & Wellness (200 quotes)
const WELLNESS_QUOTES: string[] = [
  "📆 Health is not a destination — it is a daily journey worth taking.",
  "🌿 The greatest wealth is health. Never stop investing in it.",
  "💚 Your body is your lifelong home. Take care of it.",
  "🌿 Good health is not just about the absence of disease — it is about thriving.",
  "🌿 Every step toward better health is a step worth celebrating.",
  "🌿 A healthy outside starts from the inside.",
  "🌿 Your health is an investment, not an expense.",
  "🌿 Today's healthy choices are tomorrow's strengths.",
  "🌿 Your body hears everything your mind says. Think healthy.",
  "🌿 Small positive steps in health add up to giant leaps in life.",
  "🌿 Health is a relationship between you and your body — nurture it.",
  "🌿 Being healthy is not a trend. It is a lifestyle.",
  "🥗 You only get one body. Treat it like the miracle it is.",
  "🌿 The best project you can work on is yourself and your health.",
  "🌿 Health is not just about what you eat — it is about what you think and do.",
  "💚 Take care of your body. It is the only place you have to live.",
  "💰 Your vitality is your true wealth. Guard it carefully.",
  "🌿 A healthy life is a beautiful gift you give to yourself and those you love.",
  "📆 Every day is a new opportunity to improve your health.",
  "🎯 Your health goals are possible with patience, consistency, and courage.",
  "📆 The secret to long-term health? Small, sustainable changes every day.",
  "🌿 You are healthier than you think, and more capable than you feel.",
  "🌿 The greatest investment you can make is in your own health.",
  "🌿 Do not just live — thrive. Start with your health today.",
  "🔒 Your health journey is not a competition. It is a personal commitment.",
  "🌿 Health is balance: body, mind, and spirit all in harmony.",
  "📅 Every good health habit you build today is a gift to your future self.",
  "🌿 The body achieves what the mind believes — believe in your health.",
  "📅 Healthy habits do not restrict your freedom. They expand it.",
  "🌿 Your body has an incredible capacity to heal — support it.",
  "🧠 Wellness is not a luxury. It is your fundamental right.",
  "🎯 What you do consistently is who you become. Be healthy, consistently.",
  "📅 Health is built in moments — the morning routine, the evening meal, the daily walk.",
  "🌿 Prioritizing your health is not selfish — it is essential.",
  "🌿 A healthy body gives you the energy to pursue the life you love.",
  "🏗️ Your wellbeing is your foundation. Everything else is built on it.",
  "💊 The best medicine is the one that prevents illness in the first place.",
  "🌿 Good health is not about perfection — it is about progression.",
  "💖 You deserve to feel good every single day.",
  "🌿 Your health is the engine that powers your dreams.",
  "🌿 Health is not just physical — emotional and mental health matter just as much.",
  "🌿 Every positive health choice compounds into extraordinary results.",
  "🌿 The healthiest version of you is still possible — and you are moving toward it.",
  "🌈 Living well means caring for yourself in every way possible.",
  "🌿 Health is harmony — when all parts of you are working together.",
  "📅 Your energy, your mood, your longevity — all connected to your health habits.",
  "💊 Invest in rest, nutrition, movement, and medication. The dividends are priceless.",
  "🌿 Your health is a long game. Play it with patience and persistence.",
  "🌿 Resilience in health means getting back on track every single time you drift.",
  "🌿 When your health is right, everything else feels more possible.",
  "🌿 The pursuit of health is the pursuit of your best self.",
  "🌿 Healing is not just physical — it is the reclaiming of your whole self.",
  "🌿 Your health is not just for you — it allows you to serve the ones you love.",
  "🌿 You are the author of your health story. Write it well.",
  "🌿 Health is the foundation of every great life.",
  "🌿 Do something good for your health today — even something small.",
  "👂 The body is always speaking. Are you listening?",
  "🌿 Being proactive about your health is always better than being reactive.",
  "🌿 Your health deserves as much planning as your career and relationships.",
  "📆 Every day you wake up with health is a day to be grateful for.",
  "📆 Wellness is a mosaic of many small, daily decisions.",
  "🌿 A rested body is a healthier body. Do not neglect sleep.",
  "❤️ Your heart pumps for you without question. Pump back with care.",
  "🌿 Good health multiplies your capacity for joy.",
  "💚 Be your own advocate — no one knows your body better than you.",
  "🌿 The relationship you have with your health is the most important one.",
  "🌿 Health is not the absence of struggle — it is thriving despite it.",
  "🌿 Every healthy choice you make today has a ripple effect on your future.",
  "🌿 Your health can be your superpower if you treat it with intention.",
  "🌿 You cannot pour from an empty cup. Stay healthy to give generously.",
  "💊 Movement, nourishment, rest, and medicine — your daily pillars of health.",
  "🌿 Being healthy enough to live your dreams is everything.",
  "💚 Your body is not your enemy — it is your most loyal ally.",
  "🌿 Health is the quiet confidence that comes from caring for yourself.",
  "📆 Good health is not accidental — it is cultivated, daily.",
  "💚 You have been given one body for this lifetime. Honor it.",
  "🌿 Health is the silent privilege that allows everything else.",
  "🌿 Your body knows how to heal — give it what it needs.",
  "🌿 When health becomes a priority, everything else comes into focus.",
  "🌿 The path to wellness is walked one healthy choice at a time.",
  "⚡ True vitality radiates from within — nourish yourself deeply.",
  "🌿 Health is not just living longer — it is living better.",
  "💰 Your body is your most precious resource. Invest in it wisely.",
  "🌿 The effort you put into your health today shows up in your life tomorrow.",
  "🎯 Thriving is not an accident. It is the result of consistent self-care.",
  "🌿 Your health is the best gift you can give to the people you love.",
  "🌿 Health is your story — write chapters worth reading.",
  "💚 Being well gives you the ability to fully participate in life.",
  "📆 Your cells are regenerating every day — give them the best conditions.",
  "🌿 Good health is the freedom to move, think, and live fully.",
  "🎯 Tend to your health like a garden: consistently, lovingly, patiently.",
  "🌿 The quiet strength of a healthy body carries you through every challenge.",
  "📈 Your wellness choices compound over time. Start now.",
  "🌿 Health is self-respect in action.",
  "💚 Live in a way that loves your body.",
  "📆 A healthy body is a product of daily investments.",
  "🌿 Prevention is the most powerful form of healthcare.",
  "💚 Your body is a temple — nourish it with intention.",
  "🌿 Health and happiness are deeply interconnected — pursue both.",
  "📆 Vitality is not a bonus — it is a goal worth pursuing every day.",
  "🌿 Your health is a gift to your family, your community, and yourself.",
  "💚 Take care of yourself — the world needs you at your best.",
  "⚡ The energy you have for life comes directly from how well you care for yourself.",
  "📅 Every healthy morning routine sets the tone for a vibrant day.",
  "🌿 Your health is the one asset no financial plan can replace.",
  "🔒 Be grateful for your health and committed to maintaining it.",
  "🌿 The best version of your life is lived in good health.",
  "🌿 Your physical health gives you the platform for everything else.",
  "🌿 Prioritizing your health is an act of wisdom.",
  "🌿 Health is not a state to achieve — it is a practice to sustain.",
  "💚 Your body has been with you from day one. Honor it.",
  "✅ Good health empowers you to show up fully for your life.",
  "🌿 A strong immune system, a clear mind, a full heart — that is true health.",
  "🌿 Your choices today are shaping your health five years from now.",
  "🌿 The long game of health is always worth playing.",
  "🌿 Health is the quiet foundation beneath your greatest achievements.",
  "🌿 What you invest in your health, you get back tenfold in quality of life.",
  "🦉 Honor the wisdom of your body — it knows more than you think.",
  "😴 Your body works best when it is well-fueled, well-rested, and well-cared for.",
  "🎯 Good health is not about being perfect — it is about being consistent.",
  "📅 Your healing is sacred — protect it with good habits.",
  "🧠 What you feed your body, your mind, and your soul matters.",
  "💊 Live well. Breathe deeply. Hydrate. Move. Take your medicine.",
  "📆 Health is built in the quiet, daily moments of self-care.",
  "🎁 Your vitality is your gift to the world. Preserve it.",
  "🌿 True health is about thriving, not merely surviving.",
  "📅 Every positive health habit you start today becomes your foundation for tomorrow.",
  "🌿 You are worth every effort it takes to stay healthy.",
  "🌿 A life of good health is a life of greater freedom.",
  "📆 Health is your most important relationship — tend to it daily.",
  "🌿 The best days of your life are still ahead, if you care for your health.",
  "📅 Healthy habits are boring to describe but extraordinary in their impact.",
  "🎯 Your body is resilient — support it with consistent care.",
  "📆 Health is not what happens to you — it is what you choose every day.",
  "💚 Your wellbeing affects the quality of every experience in your life.",
  "🌿 You have more power over your health than you realize.",
  "📅 Building health is a quiet revolution — one habit at a time.",
  "🌿 Your health inspires others. Be a living example of self-care.",
  "📆 Long-term health is the product of short-term daily decisions.",
  "🌿 The most sustainable health plan is the one you actually do.",
  "🌿 Health is not black and white. Progress is enough.",
  "📆 Your body is designed to thrive — help it along every day.",
  "📆 The most important health appointment you will ever have: the daily one with yourself.",
  "🌿 Health is your passport to a full, rich life.",
  "📅 Your future self is watching your habits today.",
  "🌿 Invest in health now so your future is not spent buying it back.",
  "🔒 A commitment to health is a commitment to your life's quality.",
  "📆 Your health is a daily practice that pays infinite dividends.",
  "⚡ Wellness is not the absence of illness — it is the presence of vitality.",
  "🌿 Start where you are. Use what you have. Do what you can for your health.",
  "💚 Your body has carried you this far. Carry it forward with care.",
  "🌿 Health is the ultimate form of self-expression.",
  "💚 Each day your body wakes you up is another chance to care for it well.",
  "📅 Strong habits in health create a strong foundation for life.",
  "🌿 Your health is the engine — keep it well-maintained.",
  "🔒 Wellness is not a reward for the disciplined — it is a choice for the wise.",
  "📆 You are worthy of good health. Claim it with your daily choices.",
  "🛡️ Feeling well is your default state — protect it.",
  "🌿 Your health is your competitive advantage in life.",
  "🌿 Life is better when you are healthy. Every investment proves this.",
  "🌿 Health is the foundation from which all of life's adventures launch.",
  "🎯 Consistency in health is quiet. Its results are anything but.",
  "🌿 Good health gives you the canvas to paint any life you choose.",
  "🌿 Your health journey has no finish line — just a beautiful, ongoing story.",
  "🥗 Treat your body like it belongs to someone you love.",
  "💚 Your wellbeing is your most important full-time job.",
  "🌿 Never take a healthy day for granted.",
  "🌿 The effort you spend on your health is always returned with interest.",
  "🌿 Good health is the quiet partner in all your greatest achievements.",
  "🌿 Health is precious. Handle it with care, every single day.",
  "🥗 Your body is your life's companion. Treat it as your most valued partner.",
  "🌿 Building health is building the future you want to live in.",
];

// Category C: Mental Health & Mindfulness (200 quotes)
const MINDFULNESS_QUOTES: string[] = [
  "🌿 Your mental health is just as important as your physical health.",
  "🌬️ Take a deep breath. You are doing better than you think.",
  "💗 Be gentle with yourself. You are a work in progress.",
  "🌿 Healing happens one breath at a time.",
  "🧘 It is okay to not be okay — and to reach out when you are not.",
  "🧘 Mindfulness is the art of paying attention to your life.",
  "💗 Your thoughts are not facts. Challenge them with kindness.",
  "🌿 Rest is not laziness — it is a vital part of healing.",
  "🌿 Mental health is not a luxury — it is a necessity.",
  "👣 You do not have to have it all figured out. Take it one step at a time.",
  "📆 Peace of mind is a health goal worth pursuing every day.",
  "🌿 Boundaries are a form of self-respect and mental health.",
  "🧘 Being present is the most powerful act of self-care.",
  "💖 Your mind deserves as much nourishment as your body.",
  "👂 Stress is a signal — listen to it and respond with care.",
  "⏸️ Slow down. Your well-being matters more than your to-do list.",
  "🕊️ You are allowed to prioritize your peace.",
  "🌿 Emotional health is the foundation of physical health.",
  "🌿 Breathe in healing. Breathe out tension.",
  "😴 Not every battle needs to be fought today. Rest is strategic.",
  "🧘 Your worth is not measured by your productivity.",
  "🌿 Caring for your mental health is courage, not weakness.",
  "🧘 Give yourself the grace you would give a good friend.",
  "🌿 Your inner dialogue shapes your health. Speak kindly to yourself.",
  "🌿 A peaceful mind supports a healing body.",
  "⏸️ It is okay to pause and reset.",
  "🌿 Mental health days are health days too.",
  "🌿 The mind that is at peace heals more quickly.",
  "❤️ Self-compassion is not self-pity — it is wisdom.",
  "💊 Quiet moments of reflection are medicine for the mind.",
  "🧘 Check in with yourself today: How are you, really?",
  "🫂 Your feelings are valid. So is your need for support.",
  "🌿 Healing is not just physical — tend to your emotional wounds too.",
  "🧘 You are not a burden for needing help. You are human.",
  "🌿 Mindfulness helps you live in the present, where healing happens.",
  "🌿 A rested mind is a sharper, healthier mind.",
  "🌙 The quieter you become, the more you can hear your body's needs.",
  "🌈 Worry is a misuse of imagination. Use it for hope instead.",
  "🌿 Your mental state profoundly affects your physical health.",
  "😴 You cannot pour from an empty cup — fill yours with rest and peace.",
  "💗 Be kind to your mind. It is working very hard.",
  "🌿 Health is not just the absence of pain — it is the presence of peace.",
  "💊 Gratitude is medicine. Practice it daily.",
  "🌿 Every moment you spend in stillness is a deposit in your health account.",
  "🌈 You are allowed to feel everything — and still choose hope.",
  "🌿 Your mental health shapes how you experience every moment of life.",
  "🌬️ Breathe. You have survived every difficult day so far.",
  "🌿 The body responds to what the mind believes. Believe in your healing.",
  "🌿 Do not let your worries about tomorrow steal your health today.",
  "💊 A joyful heart is good medicine.",
  "🌿 Create space in your day for peace — your health depends on it.",
  "🌿 You are enough, exactly as you are — even in the midst of healing.",
  "🌿 Mental clarity is a health outcome worth working toward.",
  "💪 There is strength in vulnerability and wisdom in asking for help.",
  "🧘 Your worth is not contingent on your wellness.",
  "❤️ Even imperfect self-care is better than none.",
  "🌿 Be patient with yourself. Healing is not linear.",
  "💊 Laughter is medicine. Find time for it.",
  "🧠 Your body and mind are deeply connected — care for both.",
  "🧘 The art of being well includes the art of letting go.",
  "🧘 Acknowledge the hard days. They pass.",
  "🌿 It is okay to slow down. Speed is not a measure of progress in health.",
  "❤️ Self-awareness is the beginning of self-care.",
  "🧘 Your emotions are not weaknesses — they are information.",
  "🧘 Forgive yourself for the days you did not take care of yourself as well as you could have.",
  "🕊️ Peace is not the absence of problems — it is the presence of equanimity.",
  "🌿 Your mind heals when given space, safety, and compassion.",
  "🌿 Mindful living leads to healthier choices, naturally.",
  "🌿 The present moment is where your healing lives.",
  "🌿 You deserve support. Asking for help is a health choice.",
  "🌿 Good mental health makes all other health challenges more manageable.",
  "🕊️ Calm your mind, and your body will follow.",
  "💎 Your resilience is remarkable. Honor it on tough days.",
  "🧘 Stress managed well is stress that does not become illness.",
  "😴 Mental rest is as essential as physical rest.",
  "🌿 The quality of your inner world determines the quality of your outer health.",
  "🌿 You are healing in ways you may not even see yet.",
  "🧘 It is okay to take things one moment at a time.",
  "🌿 Joy is not frivolous — it is a health strategy.",
  "🌿 Your emotional needs are legitimate health needs.",
  "💊 Mindfulness turns ordinary moments into medicine.",
  "🦉 Anxiety speaks loud. Learning to turn down its volume is wisdom.",
  "🧘 Your self-worth does not fluctuate with your symptoms.",
  "❤️ The journey to mental wellness starts with a single, compassionate thought.",
  "🐾 Even on hard days, there is something small to appreciate.",
  "🧘 You are not your illness. You are so much more.",
  "🌿 Healing your mind heals your whole self.",
  "📆 Strong mental health is built through daily practices, not grand gestures.",
  "💖 Your nervous system deserves tenderness.",
  "😴 You are allowed to need rest, support, and kindness.",
  "🌿 Prioritizing your mental health is the ultimate act of responsibility.",
  "🌬️ Every deep breath you take is a reset for your nervous system.",
  "💗 Be a gentle observer of your thoughts — not their servant.",
  "💊 Positive self-talk is free medicine. Use it liberally.",
  "🕊️ Your inner peace is worth protecting fiercely.",
  "🧠 The mind and body are not separate systems — care for them together.",
  "☀️ You can carry difficult things and still have lightness.",
  "❤️ Radical self-care is not selfish — it is necessary.",
  "🌿 Presence is one of the most healing things you can offer yourself.",
  "🌿 Rest is not a reward — it is a health requirement.",
  "🌿 Your mental health is the lens through which you see everything. Keep it clear.",
  "🌿 Acknowledge your feelings, then choose your next healthy step.",
  "❤️ Holding space for yourself is an act of profound self-love.",
  "💗 Mental toughness is built through kindness to yourself, not punishment.",
  "🌬️ You have permission to slow down and catch your breath.",
  "🌿 Strong mental health is the backbone of a strong life.",
  "🌿 The story you tell yourself about your health matters.",
  "💊 Daily mindfulness is daily medicine for the mind.",
  "🌿 Healing requires both action and acceptance.",
  "🛡️ Your nervous system responds to safety. Create safe spaces for yourself.",
  "🌿 It is a brave thing to take care of your mental health.",
  "🧘 Some days, surviving is enough. That is okay.",
  "🌿 You are not alone in your health journey.",
  "🌿 Practicing gratitude is one of the simplest, most powerful mental health tools.",
  "🧘 Your emotional wellbeing affects every organ in your body.",
  "💊 Seek connection when you feel most isolated — it is medicine.",
  "❤️ Be as compassionate with yourself as you would be with a child you love.",
  "💪 Your mind is most powerful when it is at ease.",
  "🌿 Every moment of stillness you create is a moment of healing.",
  "🎯 The greatest kindness you can show yourself is consistency in self-care.",
  "🌿 Feeling your feelings fully is healthier than suppressing them.",
  "🌿 You have the right to boundaries that protect your mental health.",
  "📋 Self-care is not a trend — it is a time-honored prescription for wellness.",
  "🌿 When the mind is calm, the body heals faster.",
  "🌿 Your mental health affects how you taste food, experience joy, and handle pain.",
  "🌿 Invest in your mental health the same way you invest in your physical health.",
  "🌿 Healing is not a straight line — it spirals, loops, and still moves forward.",
  "🧘 You are doing the best you can with what you have. That is always enough.",
  "🌿 Mental health maintenance is part of your health plan.",
  "📅 Find joy in small things — it is one of the most powerful health habits.",
  "🧠 Your mental wellbeing is a priority, not an afterthought.",
  "🌬️ Pause, breathe, reassess. That is wisdom, not weakness.",
  "🧘 Not every emotion needs to be fixed — some just need to be felt.",
  "💎 You are far more resilient than your hardest moment suggests.",
  "🌿 The practice of presence is the practice of health.",
  "🌿 Your thoughts shape your biology. Think healing thoughts.",
  "🌿 Compassion for yourself is the starting point for all healing.",
  "💖 You are worthy of care, especially from yourself.",
  "🌿 A kind mind is a healthy mind.",
  "🧘 Your inner dialogue is your most constant companion — make it a good one.",
  "📆 Healthy minds grow from daily practices of reflection, rest, and connection.",
  "💎 You have been resilient before. You are resilient now.",
  "🌿 The courage to care for your mental health is extraordinary.",
  "🌿 Find people who support your health journey and hold them close.",
  "🕊️ Your peace of mind is not negotiable.",
  "❤️ Even small acts of self-care create ripple effects of wellness.",
  "😴 You do not have to earn rest. Rest is your birthright.",
  "🌿 Strong emotional health means feeling deeply and still moving forward.",
  "💪 Honor your limits. Knowing them is strength.",
  "💊 A good night's sleep is one of the most underrated medicines.",
  "🌸 Your stress response is your body asking for support. Respond with care.",
  "🧘 You are enough, you have enough, you are doing enough.",
  "❤️ Mental clarity starts with physical and emotional self-care.",
  "🌿 Your capacity for healing is greater than you know.",
  "🧘 It is okay to ask: What do I need today for my wellbeing?",
  "💖 You deserve to feel well, mentally and physically.",
  "🌿 Manage your energy, not just your time. That is health leadership.",
  "😴 The quieter practices — sleep, mindfulness, gratitude — are the most powerful.",
  "🏆 You are growing through everything you are going through.",
  "🌿 Your healing matters. You matter.",
  "🌿 Peace is a health outcome. Pursue it intentionally.",
  "🧠 Being mentally well gives you the clarity to manage everything else.",
  "🧠 Taking care of your mind is taking care of your whole life.",
  "💖 Do not dismiss emotional pain. It has lessons and it deserves care.",
  "🌿 Healing takes time. Be patient with yourself.",
  "🌿 Your inner strength is your greatest health asset.",
  "🧠 Tend your mind like a garden: regularly, with love.",
  "🕊️ Serenity is not the absence of struggle — it is choosing calm within it.",
  "🧘 You are doing the work. The results are coming.",
  "😴 Prioritizing rest is not giving up — it is powering up.",
  "🌿 Your mental health journey is valid, important, and worth every effort.",
  "🌿 Every moment of mindfulness you practice is a moment of healing.",
  "💖 Be the friend to yourself that you deserve to have.",
  "🌿 Your emotional health is your responsibility and your gift.",
  "🌿 Good health starts in the mind. Care for yours.",
  "🧘 You have survived every hard day. Today is no exception.",
];

// Category D: Healthy Lifestyle (200 quotes)
const LIFESTYLE_QUOTES: string[] = [
  "💧 Drink a glass of water first thing in the morning. Your body will thank you.",
  "🌿 Sleep is not a reward — it is a health requirement. Get enough of it.",
  "📆 Move your body every day, even if it is just a short walk.",
  "🥗 What you eat today builds who you are tomorrow.",
  "📅 Hydration is one of the simplest and most effective health habits.",
  "💊 A balanced meal is a form of medicine — eat with intention.",
  "🌿 Your body was made to move. Do not forget that.",
  "🏋️ Regular movement reduces inflammation, boosts mood, and extends life.",
  "📅 Start small with healthy habits — tiny changes compound into big results.",
  "🥦 Vegetables are not a punishment — they are power for your body.",
  "🌿 A good night's sleep is the body's ultimate recovery tool.",
  "🥗 Reduce processed food and increase whole food. Your body will notice.",
  "☀️ Sunlight in the morning resets your biological clock. Step outside.",
  "🎯 Regular meals keep your blood sugar stable and your energy consistent.",
  "🌿 Sitting is the new smoking. Move more, sit less.",
  "📆 Fruits are nature's sweetest gift to your health. Eat them daily.",
  "🌿 Cooking at home is one of the highest-return health investments.",
  "🚶 Walking 10,000 steps a day is good for your body and your mind.",
  "🌿 Your gut health affects your entire wellbeing — eat fiber-rich foods.",
  "🏃 Deep breathing exercises activate your parasympathetic nervous system.",
  "🌿 Strong relationships are a health variable — invest in yours.",
  "🤸 Regular stretching improves circulation and reduces injury risk.",
  "😴 Caffeine is not a substitute for sleep — prioritize rest.",
  "🥗 Fiber feeds the good bacteria in your gut. Eat more of it.",
  "🌿 A healthy breakfast is not optional — it is a head start to your day.",
  "🌿 Sugar in excess is an inflammation trigger. Reduce it gradually.",
  "📅 Healthy habits done imperfectly beat perfect habits never started.",
  "🥗 Your kitchen is your first pharmacy. Stock it with whole foods.",
  "🌿 Standing and stretching every hour dramatically reduces health risks.",
  "🏃 Exercise releases endorphins — nature's mood elevators.",
  "🌿 Eating slowly helps digestion and prevents overeating.",
  "🚶 Take a 20-minute walk when you feel stressed — it genuinely helps.",
  "⏰ A consistent sleep schedule is as important as the hours you get.",
  "🌿 Limiting alcohol is one of the most impactful lifestyle health choices.",
  "💊 Fresh air and movement are medicine — get outside today.",
  "🌿 Your social connections are as important to your health as your diet.",
  "🌿 Posture affects breathing, mood, and muscle health. Stand tall.",
  "📅 Do not diet — build sustainable eating habits instead.",
  "💧 Your skin reflects what is happening inside. Hydrate and eat well.",
  "😄 Laughter reduces cortisol and boosts immunity. Find reasons to laugh.",
  "🌿 Stress eating is a signal — address the stress, not just the hunger.",
  "🥗 Cooking and eating together strengthens bonds and improves nutrition.",
  "🌿 Regular health check-ups catch problems before they become crises.",
  "💎 Cold showers build mental resilience and improve circulation.",
  "💪 Strong friendships reduce the risk of chronic disease. No kidding.",
  "📆 A daily gratitude practice has measurable health benefits.",
  "🧘 Eating slowly and mindfully improves both digestion and satisfaction.",
  "🥗 You cannot exercise your way out of a poor diet — both matter.",
  "💪 Green tea has powerful antioxidants. Consider swapping one coffee.",
  "😴 Your immune system loves sleep, stress reduction, and vegetables.",
  "💪 Strength training after 40 is not optional — it is essential.",
  "🌿 Omega-3 fatty acids support brain health. Eat fish or take supplements.",
  "🌿 Vitamin D from sunlight supports immunity, mood, and bone health.",
  "🥦 Eating a rainbow of vegetables gives your body a spectrum of nutrients.",
  "🥗 The best diet is the one that nourishes you and you can sustain.",
  "🌿 Healthy snacking prevents blood sugar crashes and poor decisions.",
  "😴 Avoid screen time 30 minutes before bed for better sleep quality.",
  "🥗 Plant-based meals several times a week benefit your heart and gut.",
  "😴 Reading before bed calms the mind and prepares you for deep sleep.",
  "🩺 Get your annual health screenings — prevention beats treatment.",
  "🌿 Meal prepping on Sundays sets your whole week up for healthier eating.",
  "🥗 Reducing sodium in your diet protects your heart and blood pressure.",
  "🌿 Your bathroom scale is not the only measure of health. How do you feel?",
  "🦵 Strong legs reduce fall risk as you age — squat regularly.",
  "😴 Meditation practice has remarkable effects on stress and sleep.",
  "🌿 Body weight resistance training can be done anywhere — no excuse.",
  "🏃 Do not wait for perfect conditions to exercise — start now.",
  "🎯 The Mediterranean diet is consistently rated among the healthiest in the world.",
  "🌿 Fermented foods support gut health — try yogurt, kefir, or kimchi.",
  "😴 Your immune system is strongest when you are well-rested.",
  "🚶 Nature walks reduce cortisol levels more effectively than treadmills.",
  "🥗 Quality protein at every meal helps your muscles and your metabolism.",
  "🥗 Mindful eating is when you enjoy your food and your body thanks you.",
  "💪 Strong core muscles protect your back and support your whole body.",
  "📆 Regular dental hygiene is connected to heart health. Floss daily.",
  "🏃 Being sedentary for 8 hours is harmful even if you exercise for 1.",
  "😴 Adding magnesium-rich foods to your diet improves sleep and reduces stress.",
  "🎯 Consistent hydration supports kidney function, cognition, and skin health.",
  "📈 Choosing stairs over elevators is a lifestyle choice that compounds.",
  "❤️ Cooking with olive oil is a simple swap with significant heart benefits.",
  "🌿 Dark chocolate in small amounts is a legitimate health food.",
  "🥗 Skipping breakfast leads to worse choices all day. Eat breakfast.",
  "💪 Strong friendships are linked to greater longevity. Nurture yours.",
  "🌿 Portion control is not deprivation — it is precision.",
  "📅 Your morning habits set the trajectory of your health for the day.",
  "😴 Napping for 20 minutes improves cognitive function significantly.",
  "🥗 Processed food is engineered to override your satiety — eat whole foods.",
  "🌿 Regular massage reduces muscle tension and supports recovery.",
  "🏋️ The gym is not the only place to get fit. Life is a gym.",
  "🎯 Consistency over intensity is always the winning health strategy.",
  "🌿 Learning to cook is one of the highest-yield health investments you can make.",
  "🌿 Plant protein from legumes is affordable, nutritious, and heart-healthy.",
  "😴 Reducing screen time before bed improves both sleep onset and quality.",
  "🌞 Strong bones need calcium, vitamin D, and weight-bearing exercise.",
  "😴 Avoid eating large meals late at night for better sleep and digestion.",
  "💰 Investing in good shoes reduces injury risk and improves posture.",
  "🤝 Your longevity is linked to your community — cultivate good relationships.",
  "🌿 A healthy body weight reduces the risk of dozens of chronic diseases.",
  "😴 Sleep debt is real and accumulates — prioritize quality sleep nightly.",
  "🥗 Adding turmeric to your diet has meaningful anti-inflammatory effects.",
  "🌿 Gentle yoga improves flexibility, balance, and mental health.",
  "🥗 Eat protein with every meal to maintain muscle and stabilize energy.",
  "🌿 Regular journaling supports mental health and helps process stress.",
  "🌿 Volunteering and acts of service boost health outcomes — give back.",
  "📅 A grateful outlook is one of the most scientifically supported health habits.",
  "🌿 Prevention is the most cost-effective healthcare strategy.",
  "🧠 Your gut is called your second brain — feed it wisely.",
  "🏃 Hiking in nature combines exercise, fresh air, and mental peace.",
  "🩸 Regular blood work helps you catch issues before they become serious.",
  "🥗 Eating protein for breakfast reduces hunger hormones all day.",
  "📅 Healthy habits are cumulative — start now, no matter how small.",
  "🌿 Physical activity, at any intensity, beats inactivity every time.",
  "🌿 Sitting in silence for 10 minutes a day is a proven health practice.",
  "🍎 Fruits in the morning provide energy without the insulin spike.",
  "🌿 Spend time in green spaces weekly — it is measurably good for you.",
  "🌿 Learning a new skill keeps your brain sharp — health is not just physical.",
  "🎯 The best exercise is the one you will actually do consistently.",
  "📅 Healthy aging starts with healthy habits in your 30s and 40s.",
  "🌿 Being kind to others is measurably good for your own health.",
  "🌿 Reducing sugar is hard at first, then liberating. Try it for 30 days.",
  "📆 Your daily choices are a vote for the health you want at 70.",
  "🏋️ Your body rewards movement every single time, without exception.",
  "🥗 A diet high in fiber reduces the risk of colon cancer significantly.",
  "🌿 The liver processes what you consume — be good to it.",
  "🌬️ Your lungs expand with deep breathing — do it regularly.",
  "🌿 Physical touch — hugs, massage — has measurable health benefits.",
  "🌿 Curiosity about your health is the beginning of taking charge of it.",
  "🥗 Adding herbs and spices to your food boosts nutrition and flavor.",
  "🌿 Blueberries are one of the most researched health foods — eat them.",
  "🥗 Gentle walking after meals improves digestion and blood sugar regulation.",
  "😴 The relationship between your sleep and your immune system is profound.",
  "🌿 Your brain is about 60% fat — feed it well with healthy fats.",
  "🏃 Breathwork exercises can reduce anxiety, lower blood pressure, and improve focus.",
  "🥗 Seasonal eating connects you to natural nutrition rhythms.",
  "🌿 Caring for a pet has genuine cardiovascular and mental health benefits.",
  "📅 Your body changes as you age — adapt your health habits accordingly.",
  "🌿 Eating with others is associated with better nutrition and mental health.",
  "🍎 An apple a day is a cliche for a reason. Fruit matters.",
  "🌿 Strength training once or twice a week has life-changing health benefits.",
  "🥗 You cannot out-supplement a bad diet — food comes first.",
  "🌿 Flossing your teeth is connected to your heart health. Really.",
  "🌿 Limiting sedentary time is as important as increasing active time.",
  "🌿 Your weekend choices affect your weekday health. Be intentional.",
  "🏃 Dance is exercise, joy, and social connection — all at once.",
  "💧 Drink water before every meal to aid digestion and portion control.",
  "🌿 A 5-minute morning stretch sets a healthy tone for the entire day.",
  "🎯 The healthiest people are not perfectionists — they are consistent.",
  "🥗 Eat breakfast like a king, lunch like a prince, dinner like a pauper.",
  "📅 Long daily walks are one of the healthiest habits you can build.",
  "🌿 Progress in health is usually invisible until suddenly it is not.",
  "🥩 Adequate protein intake preserves muscle mass throughout aging.",
  "❤️ Reducing stress is reducing your risk for heart disease, cancer, and more.",
  "💧 What you drink matters as much as what you eat. Choose water.",
  "🌿 Make health non-negotiable — everything else works better when you do.",
  "💊 Your lifestyle is your most powerful medicine. Use it wisely.",
  "🌿 A healthy day starts the night before — prioritize sleep.",
  "🥗 Food is information for your cells — send the right messages.",
  "🏃 Small amounts of regular exercise are dramatically better than none.",
  "🌿 Building a healthy lifestyle is the best gift you can give to everyone you love.",
  "🌿 Health is about the long game. Play it one good choice at a time.",
  "🔥 Every positive lifestyle change, however small, creates momentum.",
  "🌿 The secret to a long, healthy life: move often, eat well, sleep deeply, and love fully.",
  "🌿 Invest in your health now — the alternative is investing in illness later.",
  "🎯 You do not need to be an athlete to be healthy. You just need to be consistent.",
  "📋 Your lifestyle is your living prescription. Fill it with good habits.",
  "🌿 A healthy life is not a perfect life — it is an intentional one.",
  "🌿 Build your life around your health, not your health around your busy life.",
  "🌿 The smallest positive change in your lifestyle today creates waves of health tomorrow.",
  "🏋️ You are built for movement, not stillness. Get up and move.",
  "💊 Nutrition, exercise, sleep, and medication — the four pillars of vibrant health.",
];

// Category E: General Health Inspiration (200 quotes)
const INSPIRATION_QUOTES: string[] = [
  "💪 You are stronger than any diagnosis.",
  "📆 Every day above ground is a good day. Make the most of it.",
  "🫂 The body is capable of extraordinary things when supported.",
  "🌟 Never give up on yourself. You have what it takes.",
  "💪 Your challenges have made you stronger than you know.",
  "🌿 Hope is a health tool. Keep it close.",
  "📖 You are not defined by your medical history.",
  "🌿 The human spirit is the most powerful healing force there is.",
  "🌿 Health is not a guarantee — but it is always worth fighting for.",
  "🌟 Every challenge you have faced has been preparation for this moment.",
  "📖 Your story is not over — and the best chapters may still be ahead.",
  "🌿 You have shown up for your health. That is extraordinary.",
  "💃 Resilience is the ability to rise — and you have it in abundance.",
  "🌿 Health challenges build a kind of strength that easy times never could.",
  "🌟 You are more than your symptoms. You are a whole, beautiful person.",
  "🌿 Even on the hardest health days, you are moving forward.",
  "🫂 What you are going through is not easy. But you are not alone.",
  "🌟 The fact that you are still here, still trying, is everything.",
  "🌿 Your health journey is an act of courage, every single day.",
  "🌟 You have overcome difficult things before. You will again.",
  "🌿 Hope is not naive — it is a health strategy backed by science.",
  "🌿 Your body has incredible healing potential. Trust it.",
  "💎 You are proof that the human spirit can endure and persist.",
  "🌿 Health is not just surviving — it is choosing to live fully.",
  "🌿 The world is better with you healthy and whole in it.",
  "🌿 Your story of health and healing can inspire someone else. Keep going.",
  "🌿 Every person managing a health challenge is a hero.",
  "🌟 You did not choose your diagnosis, but you choose your response to it.",
  "💊 Faith in your healing is not wishful thinking — it is powerful medicine.",
  "🌿 You are on a health journey that takes courage every single day.",
  "🌿 Community and connection accelerate healing. Find your people.",
  "🌿 Progress in health is not always visible — trust that it is happening.",
  "🌿 You are not your worst health day.",
  "🌟 Chronic illness does not diminish your worth. You are valuable.",
  "🌟 You have already survived 100% of your hardest days. Remember that.",
  "🌟 Be proud of how far you have come — the journey has been real.",
  "🌿 The courage it takes to manage your health is immeasurable.",
  "🌿 You are an advocate for your own health — speak up.",
  "😴 Never underestimate how much progress you have made.",
  "🌿 Your healing is a gift to yourself and to everyone who loves you.",
  "👣 Keep going. Your breakthrough may be one step away.",
  "🌿 You are worth the effort it takes to be healthy.",
  "🌿 Your health story is one of resilience — and it is not finished yet.",
  "🌿 Every person managing their health is winning a quiet battle.",
  "🌟 You are capable of thriving — even through difficulty.",
  "🔒 Your commitment to your health is an act of self-love.",
  "🦁 You are not your illness. You are the person managing it — bravely.",
  "✅ On the hardest health days, you still showed up. That is enough.",
  "🌿 Your inner strength is your greatest health asset.",
  "🌿 Health challenges change people — often for the better.",
  "🤝 You have a team of people — doctors, family, friends — rooting for you.",
  "🌿 Your persistence through health challenges is your greatest achievement.",
  "🌿 The courage to seek help is the courage that leads to healing.",
  "🌿 Health management is a form of self-mastery.",
  "🌿 You inspire more people than you know with your health journey.",
  "🌿 No matter what, you are worthy of care and healing.",
  "🌿 Your health journey, with all its complexity, is making you stronger.",
  "🌿 Thriving despite a health challenge is an extraordinary achievement.",
  "🌿 You are not a patient — you are a whole person managing a health condition.",
  "🌿 Your perseverance through health challenges is your life's greatest display of strength.",
  "🌿 Every difficult health moment has taught you something valuable.",
  "🌿 You are writing a story of courage with your health journey.",
  "🌿 Do not compare your health journey to anyone else's — it is uniquely yours.",
  "📈 Progress counts, even when it is invisible to others.",
  "🌿 Your healing does not have to look like anyone else's. It just has to be yours.",
  "🦁 The people who manage chronic conditions are some of the bravest people alive.",
  "🌟 You bring so much to this world. Keep getting well.",
  "💖 You are worthy of every resource and support available to you.",
  "🌿 Your vulnerability in health matters is your most courageous act.",
  "🌿 Health setbacks are not defeats — they are redirects.",
  "🌿 Even when healing feels slow, your body is working for you.",
  "🌿 You are the architect of your healing — design it with care.",
  "🌿 There is power in the act of asking for help with your health.",
  "🌿 Health challenges are part of being human — you are not alone.",
  "🌟 You have done hard things. This is another one. You will do this too.",
  "🌿 Not every health day is a good one. But every health day is worth fighting for.",
  "💊 Your medication log is not a burden — it is a record of your dedication.",
  "🌿 Health is worth fighting for, every single day.",
  "🫂 You are not weak for needing medical support. You are wise.",
  "🌿 The people who love you want you healthy. Take care of yourself for them too.",
  "🌿 Your health is an ongoing story — keep turning the pages.",
  "🌿 There is dignity in managing a health condition with grace.",
  "🌿 Every health choice you make is a reflection of how much you value yourself.",
  "🌿 Your health team is your allies. Trust them.",
  "🌿 You are managing your health, and that alone is remarkable.",
  "🌿 Healing is a process, not an event. Trust the process.",
  "🌿 You deserve a life full of joy, connection, and good health.",
  "🌿 Every small win in your health journey deserves acknowledgment.",
  "🌿 What you are doing for your health takes guts. Be proud.",
  "🌿 Your resilience in the face of health challenges is a light for others.",
  "📆 You are doing something hard every day. That matters.",
  "🌿 The world is richer because you are in it and fighting for your health.",
  "🌿 Your health journey is not a detour — it is part of your full, rich story.",
  "🌿 You are your own best health advocate — use your voice.",
  "🌿 Whatever today holds healthwise, you are not facing it alone.",
  "🌟 There is beauty in the fight for your own wellbeing.",
  "💪 You have reserves of strength you have not even discovered yet.",
  "🌿 Taking charge of your health is one of the bravest things you will ever do.",
  "📆 Your health is your masterpiece — work on it daily with love.",
  "🌿 The most powerful thing you can do for your health is believe in your healing.",
  "🌿 You are not behind in your health journey — you are exactly where you need to be.",
  "🌿 Health is the stage on which the rest of life is performed.",
  "🌿 Every effort you make toward your health has value.",
  "🫂 Your body is extraordinary — respect it, support it, trust it.",
  "🌿 Be proud of your health journey. It belongs to you.",
  "🌿 You are more resilient than any health challenge.",
  "🌿 The strongest people are often the ones carrying invisible health burdens.",
  "🌿 Your healing is in progress, even when you cannot see it.",
  "✅ You show up for your health even when it is hard. That is true courage.",
  "🌟 You are proof that people can manage hard things and still thrive.",
  "🌿 Every health goal you have set matters. Keep moving toward it.",
  "🔒 Your dedication to health is your legacy.",
  "💊 Taking your medication every day is a quiet act of extraordinary courage.",
  "🌿 You are in the right place, doing the right things for your health.",
  "🌿 Trust your body's ability to heal with the right support.",
  "📆 The courage it takes to manage your health daily is not small — it is immense.",
  "🌿 You are worthy of healing, fully and completely.",
  "🌿 Your health journey is a testament to your character.",
  "🌟 Keep going. Your good days are waiting for you.",
  "📈 Even when progress is hard to see, it is happening. Hold on.",
  "🔒 Your commitment to your health is a form of love in action.",
  "🌿 Health is not just for the able-bodied — everyone deserves to be well.",
  "🌿 You are navigating your health journey with more wisdom than you give yourself credit for.",
  "🌿 The hardest health days often precede the best breakthroughs.",
  "🌿 You are not facing this alone. Your health team, your family — they are with you.",
  "💖 You deserve to feel well. Keep working toward it.",
  "🔒 Your commitment to your health matters deeply.",
  "🌿 There is meaning in the health journey, even when it is painful.",
  "🌿 You have more inner resources for healing than you realize.",
  "🔒 Your health journey is proof of your dedication to life.",
  "🌿 Every step forward in your health, no matter how small, is still forward.",
  "🦁 You are brave enough to take care of yourself. That is no small thing.",
  "🌟 Your wellness is a priority — not just for you, but for everyone you love.",
  "💊 Health is your birthright. Claim it with every dose, every step.",
  "🌟 You are doing extraordinarily well, even on the days it does not feel like it.",
  "🌿 Keep the faith in your healing. It is happening.",
  "🌿 Your persistence through health challenges writes a story of quiet heroism.",
  "🌟 You are more than your illness. You are full of possibility.",
  "🌿 Your health journey has value and meaning — every moment of it.",
  "🌿 The fight for your health is worth it. You are worth it.",
  "📆 You are writing a story of healing every day. It is a good one.",
  "🌿 Trust the process. Your health is improving, even slowly.",
  "🌿 You have everything you need within you to face today's health challenges.",
  "🔒 Your resilience and commitment to health are truly inspiring.",
  "💖 Never stop fighting for your wellness — you deserve it.",
  "📆 Every day you manage your health is a day well-lived.",
  "🌿 You are stronger than you think and healthier than you feel on your worst days.",
  "🌿 The courage to keep going with your health management is extraordinary.",
  "🌿 Hold on. Better health days are coming.",
  "🌟 You are not defined by your illness. You are defined by how you respond to it.",
  "📅 Your life has value — protect it with every health habit you build.",
  "🌿 Health challenges do not diminish you. They reveal your strength.",
  "🌿 You are healing. Keep believing that.",
  "🌿 Your health is your greatest story. Make it one of resilience.",
  "📆 There is nothing braver than fighting for your own health every day.",
  "🌿 The world needs you healthy. Do not give up.",
  "🌟 Your body is doing its best — help it with yours.",
  "🌿 You are an inspiration to everyone who knows your health journey.",
  "✅ Keep showing up for your health. It will show up for you.",
  "🌿 You have the power to influence your health positively every single day.",
  "💊 Your commitment is your medicine. Keep committing.",
  "🌿 The love you give your health comes back to you in vitality and joy.",
  "🌿 You are capable of more than you know. Your health journey is proof.",
  "🌿 Live your best, healthiest life. You deserve nothing less.",
  "🌿 Your health story is being written right now. Make it great.",
  "🌟 You are worth taking care of. Start — and keep — believing that.",
  "📆 Today, tomorrow, and every day: your health is worth it.",
];

export const HEALTH_QUOTES: readonly string[] = [
  ...ADHERENCE_QUOTES,
  ...WELLNESS_QUOTES,
  ...MINDFULNESS_QUOTES,
  ...LIFESTYLE_QUOTES,
  ...INSPIRATION_QUOTES,
];

const ENCOURAGEMENT_QUOTES: readonly string[] = [
  "Great job taking your dose! Consistency is your superpower.",
  "Dose logged! You are building a healthier you, one day at a time.",
  "Well done! Your commitment to health is truly admirable.",
  "Another dose taken! Your future self thanks you.",
  "You showed up for your health today. That is what champions do.",
  "Dose taken! Keep up the incredible work.",
  "Excellent! Consistent medication is the foundation of great health.",
  "You did it! Every dose brings you closer to your best health.",
  "Amazing! Your dedication to your health inspires those around you.",
  "Dose logged! Your body appreciates your care and consistency.",
  "Well done! You are investing in your health with every dose.",
  "Fantastic! You are on a roll — keep this momentum going.",
  "Dose taken! Small acts of self-care make a big difference.",
  "You are a health champion! Keep showing up for yourself.",
  "Great work! Your commitment today is your strength tomorrow.",
  "Dose logged! You are one step closer to your health goals.",
  "Well done! You are growing healthier every single day.",
  "Perfect! Hitting your medication targets is what progress looks like.",
  "Dose taken! Your resilience and consistency are remarkable.",
  "Brilliant! Another day, another dose — you are doing great.",
  "Dose logged! Your dedication to health is your daily victory.",
  "You are nailing it! Consistent medication is life-changing.",
  "Wonderful! Taking care of yourself shows how much you value your life.",
  "Dose taken! Celebrate this small win — it is not small at all.",
  "Onward! You have taken another step toward optimal health.",
  "Dose logged! Your care for yourself is beautiful.",
  "Keep going! You are stronger than you know.",
  "Well done! Health built on consistency is health that lasts.",
  "Dose taken! You have got the energy of someone who takes their health seriously.",
  "Magnificent! You are building the foundation of a healthier life.",
  "Dose logged! Every dose is a medal worth wearing.",
  "You are doing it! Consistent self-care is the greatest love.",
  "Dose taken! The bravest thing you did today? This.",
  "Amazing work! Your health routine is your greatest daily achievement.",
  "Dose logged! Your consistency shapes your health over time.",
  "Incredible! You showed up for your health today — that matters.",
  "Dose taken! Green in spirit and in health — keep going.",
  "Well done! Your health rhythm is strong — keep the beat.",
  "Dose logged! You are soaring toward better health.",
  "Your commitment to health is a rare and valuable gem.",
];

// ─── Daily quote logic ────────────────────────────────────────────────────────

export function getDailyQuote(): string {
  const today = startOfDay(new Date()).toISOString();
  const lastDate = localStorage.getItem(QUOTE_LAST_SCHEDULED_DATE_KEY);
  let index = parseInt(localStorage.getItem(QUOTE_DAY_INDEX_KEY) || "0", 10);
  if (lastDate !== today) {
    if (lastDate) {
      const daysDiff = Math.round((new Date(today).getTime() - new Date(lastDate).getTime()) / 86400000);
      index = (index + Math.max(1, daysDiff)) % HEALTH_QUOTES.length;
    }
    localStorage.setItem(QUOTE_LAST_SCHEDULED_DATE_KEY, today);
    localStorage.setItem(QUOTE_DAY_INDEX_KEY, String(index));
  }
  return HEALTH_QUOTES[index];
}

function getQuoteForDayOffset(dayOffset: number): string {
  const currentIndex = parseInt(localStorage.getItem(QUOTE_DAY_INDEX_KEY) || "0", 10);
  return HEALTH_QUOTES[(currentIndex + dayOffset) % HEALTH_QUOTES.length];
}

function advanceQuoteIndex(days: number): void {
  const currentIndex = parseInt(localStorage.getItem(QUOTE_DAY_INDEX_KEY) || "0", 10);
  localStorage.setItem(QUOTE_DAY_INDEX_KEY, String((currentIndex + days) % HEALTH_QUOTES.length));
  localStorage.setItem(QUOTE_LAST_SCHEDULED_DATE_KEY, startOfDay(addDays(new Date(), days - 1)).toISOString());
}

function getEncouragementQuote(): string {
  return ENCOURAGEMENT_QUOTES[Math.floor(Math.random() * ENCOURAGEMENT_QUOTES.length)] as string;
}

// ─── 1. Daily Quote Notifications ────────────────────────────────────────────

async function scheduleDailyQuoteNotifications(
  localBatch: LocalNotificationSchema[],
  alarmBatch: AlarmNotification[],
  ids: number[]
): Promise<void> {
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const fireDate = setTime(startOfDay(addDays(now, i)), 9, 0);
    if (fireDate <= now) continue;
    const quote = getQuoteForDayOffset(i);
    const dateKey = startOfDay(addDays(now, i)).toISOString();
    const id = stringToHash("dawa_daily_quote_" + dateKey);
    localBatch.push({ id, title: "🌟 Daily Health Quote", body: quote, schedule: { at: fireDate, allowWhileIdle: true }, channelId: CHANNEL_QUOTES, sound: "default", extra: { type: "daily_quote", route: "/" } });
    alarmBatch.push({ id, title: "🌟 Daily Health Quote", body: quote, triggerAtMillis: fireDate.getTime(), extra: JSON.stringify({ type: "daily_quote" }) });
    ids.push(id);
  }
  advanceQuoteIndex(30);
}

// ─── 2. Post-Dose Encouragement ───────────────────────────────────────────────

export async function schedulePostDoseEncouragementNotification(medicineName: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    await createEngagementChannels();
    const quote = getEncouragementQuote();
    const fireAt = new Date(Date.now() + 3000);
    const id = stringToHash("dawa_encouragement_" + medicineName + fireAt.getTime().toString());
    await LocalNotifications.schedule({ notifications: [{ id, title: `\uD83D\uDC8A ${medicineName} — Logged!`, body: quote, schedule: { at: fireAt, allowWhileIdle: true }, channelId: CHANNEL_QUOTES, sound: "default", extra: { type: "encouragement", route: "/" } }] });
    try { await NativeAlarm.scheduleAlarms({ notifications: [{ id, title: `\uD83D\uDC8A ${medicineName} — Logged!`, body: quote, triggerAtMillis: fireAt.getTime(), extra: JSON.stringify({ type: "encouragement" }) }] }); }
    catch (e) { console.warn("[quotesService] NativeAlarm encouragement failed (non-fatal):", e); }
  } catch (err) { console.warn("[quotesService] schedulePostDoseEncouragementNotification failed:", err); }
}

// ─── 3. Evening Check-In ─────────────────────────────────────────────────────

async function scheduleEveningCheckIns(
  reminders: Reminder[],
  localBatch: LocalNotificationSchema[],
  alarmBatch: AlarmNotification[],
  ids: number[]
): Promise<void> {
  if (!reminders.some((r) => r.enabled)) return;
  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const fireDate = setTime(startOfDay(addDays(now, i)), 20, 0);
    if (fireDate <= now) continue;
    const dateKey = startOfDay(addDays(now, i)).toISOString();
    const id = stringToHash("dawa_evening_checkin_" + dateKey);
    const body = "Have you logged all your medications today? A quick check keeps your health on track.";
    localBatch.push({ id, title: "\uD83C\uDF19 Evening Check-In", body, schedule: { at: fireDate, allowWhileIdle: true }, channelId: CHANNEL_WELLNESS, sound: "default", extra: { type: "evening_checkin", route: "/" } });
    alarmBatch.push({ id, title: "\uD83C\uDF19 Evening Check-In", body, triggerAtMillis: fireDate.getTime(), extra: JSON.stringify({ type: "evening_checkin" }) });
    ids.push(id);
  }
}

// ─── 4. Hydration Reminders ──────────────────────────────────────────────────

const HYDRATION_MESSAGES: readonly string[] = [
  "\uD83D\uDCA7 Time to hydrate! A glass of water now keeps fatigue away.",
  "\uD83D\uDCA7 Drink up! Staying hydrated supports your medication and your health.",
  "\uD83D\uDCA7 Water break! Hydration keeps your kidneys happy and your energy high.",
  "\uD83D\uDCA7 Your body is about 60% water — keep it that way. Drink up!",
  "\uD83D\uDCA7 Sip some water! It helps your medication absorb better.",
  "\uD83D\uDCA7 Quick water break! Your brain and body both need it.",
  "\uD83D\uDCA7 Stay hydrated! Even mild dehydration affects focus and mood.",
];

async function scheduleHydrationReminders(
  localBatch: LocalNotificationSchema[],
  alarmBatch: AlarmNotification[],
  ids: number[]
): Promise<void> {
  const now = new Date();
  const hydrationHours = [8, 10, 12, 14, 16, 18];
  for (let i = 0; i < 7; i++) {
    for (const hour of hydrationHours) {
      const fireDate = setTime(startOfDay(addDays(now, i)), hour, 0);
      if (fireDate <= now) continue;
      const dateKey = `${startOfDay(addDays(now, i)).toISOString()}_${hour}`;
      const id = stringToHash("dawa_hydration_" + dateKey);
      const body = HYDRATION_MESSAGES[Math.floor(Math.random() * HYDRATION_MESSAGES.length)] as string;
      localBatch.push({ id, title: "\uD83D\uDCA7 Hydration Reminder", body, schedule: { at: fireDate, allowWhileIdle: true }, channelId: CHANNEL_HYDRATION, sound: "default", extra: { type: "hydration", route: "/" } });
      alarmBatch.push({ id, title: "\uD83D\uDCA7 Hydration Reminder", body, triggerAtMillis: fireDate.getTime(), extra: JSON.stringify({ type: "hydration" }) });
      ids.push(id);
    }
  }
}

// ─── 5. Weekly Adherence Summary ─────────────────────────────────────────────

async function scheduleWeeklyAdherenceSummary(
  localBatch: LocalNotificationSchema[],
  alarmBatch: AlarmNotification[],
  ids: number[]
): Promise<void> {
  const now = new Date();
  let daysUntilSunday = (7 - getDay(now)) % 7;
  if (daysUntilSunday === 0) daysUntilSunday = 7;
  for (let week = 0; week < 8; week++) {
    const fireDate = setTime(startOfDay(addDays(now, daysUntilSunday + week * 7)), 20, 0);
    if (fireDate <= now) continue;
    const dateKey = startOfDay(addDays(now, daysUntilSunday + week * 7)).toISOString();
    const id = stringToHash("dawa_weekly_summary_" + dateKey);
    const body = "How did you do with your medications this week? Tap to see your adherence report and keep up the momentum!";
    localBatch.push({ id, title: "\uD83D\uDCCA Your Weekly Health Summary", body, schedule: { at: fireDate, allowWhileIdle: true }, channelId: CHANNEL_QUOTES, sound: "default", extra: { type: "weekly_summary", route: "/history" } });
    alarmBatch.push({ id, title: "\uD83D\uDCCA Your Weekly Health Summary", body, triggerAtMillis: fireDate.getTime(), extra: JSON.stringify({ type: "weekly_summary" }) });
    ids.push(id);
  }
}

// ─── 6. Streak Notifications ─────────────────────────────────────────────────

export function computeCurrentStreak(doseLogs: DoseLog[], reminders: Reminder[]): number {
  const activeReminders = reminders.filter((r) => r.enabled && !r.patientId);
  if (activeReminders.length === 0) return 0;
  const today = startOfDay(new Date());
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const dayStart = startOfDay(subDays(today, i));
    const dayEnd = new Date(dayStart.getTime() + 86400000);
    const allTaken = activeReminders.every((r) =>
      doseLogs.some((log) => log.reminderId === r.id && log.action === "taken" && isAfter(parseISO(log.actionTime), dayStart) && !isAfter(parseISO(log.actionTime), dayEnd))
    );
    if (!allTaken) { if (i > 0) break; } else { streak++; }
  }
  return streak;
}

export async function scheduleStreakNotification(streak: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const MILESTONES = [3, 7, 14, 30, 60, 90, 180, 365];
  if (!MILESTONES.includes(streak)) return;
  const todayKey = new Date().toDateString();
  const dedupeKey = `dawa_streak_${streak}_${todayKey}`;
  if (localStorage.getItem(dedupeKey)) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    await createEngagementChannels();
    const streakMessages: Record<number, string> = {
      3: `\uD83D\uDD25 3-Day Streak! You have taken every dose for 3 days in a row. Keep the momentum going!`,
      7: `\uD83D\uDD25 7-Day Streak! One full week of perfect medication adherence. You are on fire!`,
      14: `\uD83C\uDFC6 2-Week Streak! 14 days of consistent medication. This is incredible dedication!`,
      30: `\uD83C\uDF1F 30-Day Streak! A full month of perfect adherence! You are a health champion!`,
      60: `\uD83D\uDC8E 60-Day Streak! Two months of consistent medication — extraordinary commitment!`,
      90: `\uD83D\uDC51 90-Day Streak! 3 months of perfect adherence. You are a legend!`,
      180: `\uD83D\uDE80 180-Day Streak! Half a year of consistent health management. Phenomenal!`,
      365: `\uD83C\uDF8A 365-Day Streak! One full year of perfect adherence — you are an inspiration!`,
    };
    const body = streakMessages[streak] ?? `\uD83D\uDD25 ${streak}-Day Streak! Amazing consistency with your medication!`;
    const fireAt = new Date(Date.now() + 2000);
    const id = stringToHash("dawa_streak_notif_" + streak + "_" + todayKey);
    await LocalNotifications.schedule({ notifications: [{ id, title: `\uD83D\uDD25 ${streak}-Day Medication Streak!`, body, schedule: { at: fireAt, allowWhileIdle: true }, channelId: CHANNEL_STREAKS, sound: "default", extra: { type: "streak", streak, route: "/history" } }] });
    try { await NativeAlarm.scheduleAlarms({ notifications: [{ id, title: `\uD83D\uDD25 ${streak}-Day Medication Streak!`, body, triggerAtMillis: fireAt.getTime(), extra: JSON.stringify({ type: "streak", streak }) }] }); }
    catch (e) { console.warn("[quotesService] NativeAlarm streak failed (non-fatal):", e); }
    localStorage.setItem(dedupeKey, "1");
  } catch (err) { console.warn("[quotesService] scheduleStreakNotification failed:", err); }
}

// ─── 7. Wellness Log Nudge ───────────────────────────────────────────────────

export async function scheduleWellnessNudge(wellnessLogs: WellnessLog[]): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const todayKey = new Date().toDateString();
  const dedupeKey = `dawa_wellness_nudge_${todayKey}`;
  if (localStorage.getItem(dedupeKey)) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    const hasRecentLog = wellnessLogs.some((log) => isAfter(parseISO(log.timestamp), subDays(new Date(), 3)));
    if (hasRecentLog) return;
    await createEngagementChannels();
    const fireAt = new Date(Date.now() + 2000);
    const id = stringToHash("dawa_wellness_nudge_" + todayKey);
    const body = "It has been a few days since your last wellness log. How are you feeling? Log a symptom or mood update to stay on top of your health.";
    await LocalNotifications.schedule({ notifications: [{ id, title: "\uD83E\uDE7A Wellness Check-In", body, schedule: { at: fireAt, allowWhileIdle: true }, channelId: CHANNEL_WELLNESS, sound: "default", extra: { type: "wellness_nudge", route: "/wellness" } }] });
    try { await NativeAlarm.scheduleAlarms({ notifications: [{ id, title: "\uD83E\uDE7A Wellness Check-In", body, triggerAtMillis: fireAt.getTime(), extra: JSON.stringify({ type: "wellness_nudge" }) }] }); }
    catch (e) { console.warn("[quotesService] NativeAlarm wellness nudge failed (non-fatal):", e); }
    localStorage.setItem(dedupeKey, "1");
  } catch (err) { console.warn("[quotesService] scheduleWellnessNudge failed:", err); }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function scheduleEngagementNotifications(
  doseLogs: DoseLog[],
  reminders: Reminder[],
  wellnessLogs: WellnessLog[]
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    await createEngagementChannels();
    await cancelPreviousEngagementNotifs();
    const localBatch: LocalNotificationSchema[] = [];
    const alarmBatch: AlarmNotification[] = [];
    const ids: number[] = [];
    await scheduleDailyQuoteNotifications(localBatch, alarmBatch, ids);
    await scheduleEveningCheckIns(reminders, localBatch, alarmBatch, ids);
    await scheduleHydrationReminders(localBatch, alarmBatch, ids);
    await scheduleWeeklyAdherenceSummary(localBatch, alarmBatch, ids);
    await scheduleNotif(localBatch, alarmBatch);
    saveEngagementIds(ids);
    await scheduleWellnessNudge(wellnessLogs);
    const streak = computeCurrentStreak(doseLogs, reminders);
    if (streak > 0) await scheduleStreakNotification(streak);
    console.log(`[quotesService] Scheduled ${localBatch.length} engagement notifications + ${alarmBatch.length} native alarms.`);
  } catch (err) { console.warn("[quotesService] scheduleEngagementNotifications failed:", err); }
}
