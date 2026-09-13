/**
 * engagementQuotes.ts
 *
 * Rich, curated, evidence-informed collections of health & wellness engagement quotes:
 * 1. HYDRATION_MESSAGES (120 quotes) — Covers cellular vitality, kidney filtration,
 *    medication absorption & dissolution, cognitive clarity, stamina, headache prevention,
 *    joint lubrication, and mindful daily water habits.
 * 2. EVENING_CHECKIN_MESSAGES (50 quotes) — Evening dose confirmation, day-end reflections,
 *    sleep hygiene, peace of mind, and preparing for tomorrow.
 * 3. WEEKLY_SUMMARY_MESSAGES (24 quotes) — Weekly adherence tracking, momentum celebrations,
 *    and weekly health reviews.
 * 4. WELLNESS_NUDGE_MESSAGES (24 quotes) — Gentle prompts to log symptoms, mood, and vitality.
 */

// ─── 1. Hydration Quotes (120 unique quotes) ─────────────────────────────────

export const HYDRATION_MESSAGES: readonly string[] = [
  // ── Kidney Health & Waste Clearance ──
  "💧 Water break! Hydration keeps your kidneys happy and your energy high.",
  "🚰 Give your kidneys a helping hand — a refreshing glass of water keeps waste filtration smooth.",
  "💧 Pure water helps your kidneys filter your bloodstream efficiently. Drink up!",
  "🌊 Stay ahead of dehydration! Your kidneys rely on steady fluid balance to protect your body.",
  "💧 Water keeps the natural filtration pathways of your kidneys and liver flowing freely.",
  "🚰 Drink a crisp glass of water! Gentle, steady hydration prevents kidney strain throughout your day.",
  "💧 Kidney care in a cup: drinking water consistently helps prevent mineral buildup and stones.",
  "🌊 Clear urine is a sign of happy kidneys. Sip a glass of water now to stay in the healthy zone!",
  "💧 Flush out metabolic waste naturally with a cool, tall glass of fresh water.",
  "🚰 Your kidneys filter over 100 liters of blood each day — support their heroic work with water!",

  // ── Medication Dissolution, Absorption & GI Protection ──
  "💧 Sip some water! It helps your medication dissolve and absorb better into your system.",
  "💊 Drink up! Staying hydrated supports your medication and your overall physical health.",
  "💧 Pairing water with your medication protects your stomach lining and speeds therapeutic absorption.",
  "🥤 Water ensures pills travel smoothly down the esophagus without irritating sensitive tissue.",
  "💧 Good hydration helps your bloodstream transport essential medicine evenly throughout your body.",
  "💊 A full glass of water with each dose optimizes how your liver and kidneys metabolize medication.",
  "💧 Hydration protects your digestive tract from irritation caused by concentrated medications.",
  "🥤 Water is the ultimate delivery vehicle for your prescriptions and daily vitamins. Drink up!",
  "💧 Help your medication do its best work by giving your cells the fluid balance they need.",
  "💊 Water reduces medication side effects by supporting steady, predictable metabolic breakdown.",

  // ── Cellular Energy, Stamina & Fighting Fatigue ──
  "💧 Time to hydrate! A glass of water now keeps physical fatigue away.",
  "⚡ Feeling tired? Before reaching for sugar or caffeine, rehydrate your cells with pure water.",
  "💧 Even mild 1-2% dehydration robs your body of energy. Recharge your batteries with water now!",
  "🏃 Water delivers oxygen and vital nutrients directly to tired muscle cells. Sip and revitalize!",
  "💧 Your body is about 60% water — keep it that way for boundless daily stamina. Drink up!",
  "⚡ Beat the afternoon slump! A cold glass of water acts like a natural, jitter-free energy boost.",
  "💧 Hydration revives your cells from the inside out, restoring vigor and natural vitality.",
  "🏃 Keep your physical stamina strong and steady all afternoon with regular sips of fresh water.",
  "💧 Water is pure fuel for your mitochondria — take a quick pause and drink a cup!",
  "⚡ Combat midday tiredness at the root cause by enjoying a tall, crisp glass of water.",

  // ── Brain Power, Mental Focus, Clarity & Mood ──
  "💧 Quick water break! Your brain and body both need fluid to stay sharp and alert.",
  "🧠 Your brain is over 70% water. Feed it hydration for razor-sharp focus and mental agility.",
  "💧 Stay hydrated! Even mild dehydration affects memory, attention span, and mood.",
  "✨ Brain fog? A tall glass of water often restores clarity faster than a screen break.",
  "💧 Dehydration triggers stress hormones in the brain. Soothe your nervous system with water.",
  "🧠 Sharpen your decision-making and cognitive flow with a mindful, refreshing sip of water.",
  "💧 Feeling irritable or overwhelmed? A simple glass of water can reset your mental equilibrium.",
  "✨ Water fuels neurological transmission and keeps your mental gears turning smoothly.",
  "💧 Elevate your mood naturally: steady hydration supports balanced serotonin and dopamine levels.",
  "🧠 Keep your focus locked in on what matters today. Sip water and keep your mind clear.",

  // ── Headache & Migraine Prevention ──
  "💧 Headache creeping in? Drink a full glass of water first — dehydration is the top silent culprit.",
  "🧊 Prevent tension headaches before they start with steady sips of water throughout the day.",
  "💧 When brain tissue loses hydration, it shrinks slightly away from the skull, causing pain. Drink up!",
  "🧊 Cool, refreshing water relaxes constricted blood vessels and eases head tension naturally.",
  "💧 Don't let dehydration masquerade as a stress headache — replenish your fluids right now!",

  // ── Joints, Muscles, Flexibility & Cramp Prevention ──
  "💧 Hydration cushions your joints and keeps spinal cartilage flexible, resilient, and pain-free.",
  "💪 Prevent painful muscle cramps and twitches by keeping your electrolyte and fluid levels balanced.",
  "💧 Synovial fluid protects every joint in your body — and it depends 100% on how much water you drink.",
  "🏃 Water eases joint stiffness after sitting or exercising. Stand up, stretch, and sip water!",
  "💪 Hydrated muscles contract more efficiently and recover much faster after physical movement.",
  "💧 Lubricate your joints from within — a glass of water now protects your comfort all day.",

  // ── Skin Health, Radiance & Temperature Control ──
  "💧 Radiant skin starts from within! Hydration flushes cellular toxins and enhances natural glow.",
  "🌿 Water keeps your skin elastic, supple, and protected against environmental dryness.",
  "💧 Your body regulates internal temperature through perspiration and hydration. Keep it balanced!",
  "🌿 Give your skin cells the moisture they crave with a refreshing glass of clean water.",
  "💧 Glow from the inside out: steady water intake is the most effective beauty routine in the world.",

  // ── Digestion, Heart Health & Circulation ──
  "💧 Water break! Hydration aids smooth digestion and nutrient absorption after every meal.",
  "❤️ Drinking water helps maintain healthy blood volume, easing the workload on your heart.",
  "💧 Prevent sluggish digestion and bloating by sipping room-temperature water throughout the day.",
  "❤️ Proper hydration helps keep blood vessels supple and blood pressure smoothly regulated.",
  "💧 Water lubricates the entire digestive tract, preventing constipation and discomfort.",
  "❤️ Help your cardiovascular system pump smoothly by maintaining optimal fluid balance today.",

  // ── Time-of-Day Cues (Morning, Midday, Afternoon, Evening) ──
  "🌅 Good morning! Rehydrate your system with water to kickstart your metabolism for the day.",
  "☀️ Midday hydration check: you are halfway through the day, make sure your water intake is on pace!",
  "🌤️ Afternoon hydration reminder: recharge your focus and finish your tasks with clean energy.",
  "🌇 Evening water pause: sip lightly to stay hydrated without disturbing your restful sleep.",
  "🌅 Wake up your digestive fire with a fresh glass of water before your first meal of the day.",
  "☀️ High noon refresher: step away from your desk, stretch, and savor a cool glass of water.",
  "🌤️ 3 PM energy dip? Swap the sugary snack for a tall glass of icy water and feel the difference.",
  "🌇 Sunset hydration: acknowledge the hard work your body did today with a mindful glass of water.",

  // ── Mindful Habits & Water Tips ──
  "💧 Hydration pause: Take three slow, deep breaths, drink a glass of water, and return refreshed.",
  "🍋 Tip: Add a slice of lemon, lime, or fresh cucumber to your water for a zesty flavor upgrade!",
  "💧 Keep a water bottle right by your side — visibility is the secret to building lasting habits.",
  "🌿 Make hydration your favorite small habit — one glass at a time, you are actively thriving.",
  "💧 Sip, don't gulp! Sipping water steadily across the hour maximizes cellular absorption.",
  "🧊 Cold or warm, sparkling or still — choose whatever water makes you excited to hydrate today!",
  "💧 Listen to your thirst: by the time your mouth feels dry, mild dehydration has already set in.",
  "🌿 Treat drinking water as a micro-meditation: feel the cool refreshment nourish every single cell.",
  "💧 Small sips throughout the morning prevent big fatigue in the afternoon. Keep that bottle close!",
  "🧊 A glass of water before meals primes your digestive enzymes and prevents overeating.",

  // ── Inspiring Daily Motivation & Wellness Wisdom ──
  "💧 Your body is a temple of living cells — honor it today with pure, clean hydration.",
  "🌱 Like a flourishing plant, you thrive and grow vibrant when regularly watered. Drink up!",
  "💧 Caring for yourself is an active choice. Drinking a glass of water right now is self-love in action.",
  "✨ You deserve to feel your absolute best today. Start with this simple, refreshing glass of water.",
  "💧 Consistency in hydration creates consistency in vitality. Keep up your great health routine!",
  "🌱 Every sip of water is a vote of confidence in your long-term health and well-being.",
  "💧 True wellness does not have to be complicated: drink water, move gently, and rest deeply.",
  "✨ Celebrate the simple blessings of clean water. Nourish your body with gratitude and hydration.",
  "💧 Health is built on foundational basics. Today, let hydration be your strongest foundation.",
  "🌱 A hydrated body is a resilient body. Take a moment right now and drink a glass of water.",

  // ── Extra Hydration Wisdom ──
  "💧 Water lubricates your vocal cords and clears throat dryness. Keep your voice strong and clear!",
  "🚰 Clear mind, steady heart, hydrated cells: you are doing everything right for your wellness.",
  "💧 Don't wait until you are parched — proactive hydration keeps your energy curve steady all day.",
  "🌊 Ride the wave of good health! A glass of water now keeps your momentum rolling forward.",
  "💧 Hydration is the quiet hero behind good digestion, clear thinking, and physical stamina.",
  "🥤 Refill that water glass! Your future self this afternoon will thank you for hydrating now.",
  "💧 Take pride in the small health habits you keep. Sip your water and smile at your progress.",
  "🚰 Keep the flow going: steady hydration keeps your lymph system clearing cellular waste smoothly.",
  "💧 Water fuels your cellular powerhouses. Power up your day with a crisp, cool glass of water.",
  "🌿 Every glass of water helps maintain the delicate electrolyte balance that powers your heartbeat.",
  "💧 Dehydration thickens blood, making your heart work harder. Lighten the load with a glass of water.",
  "🚰 Hydration is free medicine for your kidneys, joints, and brain. Drink deeply and enjoy!",
  "💧 Cool down, refresh, and renew: water is the ultimate reset button for a busy, hectic day.",
  "🌊 Stay buoyant and bright! Your body thrives when you give it the pure water it needs.",
  "💧 Feeling stuck on a problem? Stand up, drink a full glass of water, and return with fresh eyes.",
  "🚰 A glass of water right now is a promise kept to your body. Drink up and feel the vitality!",
  "💧 Hydration supports natural collagen production, keeping your connective tissues supple.",
  "🌿 Your immune system relies on water to transport white blood cells throughout your body.",
  "💧 Boost your immunity with steady fluid intake — well-hydrated mucous membranes trap germs better.",
  "🚰 Drink water today as an investment in how light, focused, and energized you will feel tomorrow.",
  "💧 Refresh your spirit! A tall glass of water brings calm and clarity to your day.",
  "🚰 Keep the hydration habit strong! Every sip supports your wellness journey.",
  "💧 Water helps your body flush excess sodium, supporting healthy blood pressure.",
  "🌊 Drink pure water and feel the refreshing ripple through every single muscle.",
  "💧 Hydration is essential self-care that costs nothing and delivers boundless vitality.",
  "🥤 Glass half empty? Fill it with water and hydrate your way to peak performance!",
  "💧 Steady water intake helps regulate blood sugar absorption and digestive ease.",
  "🌿 Connect with your body: take a mindful sip of water and notice the instant refresh.",
  "💧 Power up your afternoons: water keeps your circadian energy steady without a crash.",
  "🚰 Drink to your health, your longevity, and your radiant vitality today!"
];

// ─── 2. Evening Check-In Messages (50 unique quotes) ─────────────────────────

export const EVENING_CHECKIN_MESSAGES: readonly string[] = [
  "🌙 Evening check-in: Have you logged all your medications today? Consistency is your superpower.",
  "🛌 Winding down for the night? Take 10 seconds to verify today's doses are fully checked off.",
  "✨ A quiet evening moment: Confirm your medication log so you can sleep with total peace of mind.",
  "🌙 Rest easy tonight knowing you took great care of your health today. All doses logged?",
  "🌟 Your evening routine sets the tone for tomorrow's energy. Did you record your final doses?",
  "🕯️ Pause and reflect: Today's consistency is tomorrow's vitality. Make sure all doses are recorded.",
  "🌙 Good night, health champion! A quick glance at DawaLens keeps your adherence streak unbroken.",
  "🌿 End your day on a strong note: double-check your dose tracker before heading to bed.",
  "🌙 Sleep restores the body, and consistency protects your wellness. Have you taken your night meds?",
  "🛌 A restful night begins with a clear mind. Confirm your medication schedule before sleep.",
  "🌙 Time to recharge! Check that all scheduled medications for today have been taken and logged.",
  "✨ Peace of mind is the best sleep aid. A quick check of your medicines ensures a worry-free night.",
  "🌙 Beautiful work today! Take one quick glance at your dose schedule before drifting off to sleep.",
  "🌟 Consistency builds lasting health. Confirm your evening doses and celebrate another day on track.",
  "🌙 Tomorrow starts tonight: prepare tomorrow's medications and check off today's doses now.",
  "🛌 Close out today's chapter with pride in your health dedication. Have you logged your doses?",
  "🌙 Your wellness journey made real progress today. Confirm your doses and rest well tonight.",
  "✨ Soft reminder: Did you remember your evening dose? Log it now to keep your streak shining.",
  "🌙 Give yourself credit for showing up for your health today. All daily medicines checked off?",
  "🕯️ A mindful evening check-in: review your medicine schedule, breathe deeply, and prepare for rest.",
  "🌙 Health habits completed today bring strength tomorrow. Make sure your night doses are logged.",
  "🛌 Sleep deeply knowing your medications are up to date. Tap to verify today's dose logs.",
  "🌙 Another day of dedication behind you! Check off any remaining doses before you turn off the lights.",
  "🌟 Take pride in your consistency tonight. Confirm today's medication logs and rest easy.",
  "🌙 Quiet your mind and let your body heal tonight. Have you logged all your medications today?",
  "✨ A small act of evening care: verify your doses in DawaLens and protect your hard-earned streak.",
  "🌙 Nighttime routine check: glass of water ready? Evening doses logged? Sleep well tonight!",
  "🌿 Rest is essential medicine. Close out today's health logs so your mind can completely relax.",
  "🌙 You stayed dedicated to your wellness today. Confirm your medication logs and enjoy your evening.",
  "🛌 Sweet dreams start with completed routines. Did you log your final doses for today?",
  "🌙 Honor your body's healing process tonight by ensuring all scheduled medicines were taken.",
  "🌟 Your future vitality thanks you for today's consistency. Double-check your dose logs tonight!",
  "🌙 Gentle reminder: verify your evening medications so you can wake up feeling accomplished.",
  "✨ Wrap up your day with confidence. Check off your doses and enjoy a calm, restorative evening.",
  "🌙 Consistency is built one evening at a time. Make sure all of today's doses are accounted for.",
  "🛌 Cozy evening, healthy routine: verify your doses on DawaLens and get ready for restful sleep.",
  "🌙 Step into dreamland with a 100% adherence score today. Have you logged every scheduled dose?",
  "🕯️ Let go of the day's stress and celebrate your health wins. Are all your doses marked taken?",
  "🌙 A peaceful bedtime begins with taking care of your essentials. Confirm your evening medications.",
  "🌟 Every day you stick to your routine is a victory. Check off your doses and rest like a champion.",
  "🌙 Evening check-in: a quick tap now keeps your health records accurate and your doctor informed.",
  "🛌 You showed up for yourself today! Confirm your evening medications and settle in for rest.",
  "🌙 Keep your streak thriving! A 5-second check-in ensures no evening dose is left behind.",
  "✨ Sleep is when your body repairs and rebuilds. Support it by confirming your night doses now.",
  "🌙 End the day with gratitude for your body's resilience. All medication logs up to date?",
  "🌿 Unwind with total peace of mind: double-check your dose schedule and let sleep do its magic.",
  "🌙 Nighttime check: verify today's medication logs, drink a small sip of water, and rest well.",
  "🛌 Consistency today, vitality tomorrow. Make sure your evening medicines are taken and recorded.",
  "🌙 You are doing an incredible job taking charge of your health. Check off your doses tonight!",
  "🌟 Rest well tonight, knowing you prioritized your health today. All doses logged in DawaLens?"
];

// ─── 3. Weekly Adherence Summary Messages (24 unique quotes) ─────────────────

export const WEEKLY_SUMMARY_MESSAGES: readonly string[] = [
  "📊 Another week in the books! Tap to see your 7-day adherence report and celebrate your progress.",
  "📈 Sunday reflection: Check your weekly medication stats and see your consistency in action!",
  "🏆 Weekly health review: Every dose logged this week is a win for your long-term vitality. Tap to explore.",
  "🗓️ New week, renewed dedication! Take a look at your adherence score from the past 7 days.",
  "🌟 You invested in your well-being every day this week. Review your weekly summary and keep shining.",
  "📊 Consistency check: How did your medication schedule go this week? View your full report now.",
  "📈 Small daily habits add up to big weekly victories. Tap to inspect your 7-day medication trend!",
  "🏆 You are building a rock-solid health foundation. Check out your weekly adherence highlights now.",
  "🗓️ Sunday check-in: Celebrate the wins of this past week and set your health goals for the week ahead.",
  "🌟 Weekly milestones matter! Tap to review your dose history and see how steady you have been.",
  "📊 Your health data tells a story of commitment. See your complete weekly adherence breakdown now.",
  "📈 Looking back on your week: consistency is where healing happens. Check your adherence score!",
  "🏆 Championing your health one week at a time! Open DawaLens to view your 7-day wellness summary.",
  "🗓️ Take 60 seconds to review your week. Your dedication to your medication routine is truly inspiring.",
  "🌟 Great habits lead to great vitality. Check out your weekly adherence stats and keep up the momentum!",
  "📊 See the proof of your dedication: tap here to review your 7-day medication report and streak.",
  "📈 Reflect, recharge, and renew: view your weekly dose history and prepare for another winning week.",
  "🏆 Adherence excellence! Tap to see your weekly performance and celebrate your commitment to health.",
  "🗓️ End-of-week review: Did you hit your medication goals? Explore your adherence insights now.",
  "🌟 Weekly progress check: you are moving closer to optimal health with every scheduled dose.",
  "📊 Knowledge is power! Review your weekly adherence graphs and share your success with your care team.",
  "📈 A week of healthy choices is behind you. Tap to view your 7-day adherence summary in DawaLens.",
  "🏆 Consistency creates miracles over time. Inspect your weekly medication logs and feel proud!",
  "🗓️ Step into the new week with clear health data. Review your weekly summary report now."
];

// ─── 4. Wellness Nudge Messages (24 unique quotes) ───────────────────────────

export const WELLNESS_NUDGE_MESSAGES: readonly string[] = [
  "🩺 How are you feeling today? Take 30 seconds to log your symptoms, mood, or vitality level.",
  "🌿 Gentle wellness check-in: Tracking how your body responds helps optimize your care routine.",
  "💭 Listening to your body is powerful medicine. Log a quick mood or symptom update in DawaLens.",
  "🤍 A moment for you: It's been a few days since your last wellness log. How is your energy today?",
  "📝 Keeping a regular wellness log gives you and your doctor valuable insights. Share an update today!",
  "🌸 Notice how you feel right now. Log your wellness pulse and keep your health history complete.",
  "🩺 Check in with yourself: Are you experiencing any side effects or feeling full of vitality?",
  "🌿 Self-awareness is key to healing. Tap to record how you are feeling in your Wellness Hub.",
  "💭 Your body is constantly talking to you. Take a brief pause and log your symptoms or energy.",
  "🤍 Health is more than pills — it is how you feel every day. Update your mood and wellness log now.",
  "📝 A quick 10-second check-in helps spot patterns early. Log your wellness status in DawaLens today.",
  "🌸 How is your body feeling right now? Record your physical sensations and mood in a quick log.",
  "🩺 Mindful pause: reflect on your symptoms and energy. A quick wellness update keeps records fresh.",
  "🌿 Connect with your well-being today: log your mood, stress level, or any noticeable symptoms.",
  "💭 Your feelings and symptoms matter. Tap to record a quick wellness entry in your health journal.",
  "🤍 Take a deep breath and check in with your body. How are you feeling this week?",
  "📝 Help your doctor see the full picture: regularly logging your wellness gives invaluable context.",
  "🌸 Track your healing journey: log your physical comfort, energy, and mood in DawaLens today.",
  "🩺 Subtle changes matter! Log how you are feeling today so you can track your health trajectory.",
  "🌿 Pause, reflect, and record: a quick wellness check-in keeps your personalized care on track.",
  "💭 How has your energy been lately? Tap here to log a quick symptom or mood update.",
  "🤍 Give your health journey the attention it deserves. Update your wellness log in DawaLens now.",
  "📝 Documenting your daily wellness helps celebrate how far you have come. Share a quick update!",
  "🌸 A gentle prompt to listen inward: how are you feeling today? Tap to record your wellness pulse."
];
