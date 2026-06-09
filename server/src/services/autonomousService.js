import * as aiService from './aiService.js';
import { sendPushNotification } from './notificationService.js';
import { db } from '../db.js';

/**
 * 1. Autonomous Safety Interceptor
 * Runs after a new medicine is added to check for interactions.
 */
export const interceptMedicineSafety = async (userId, patientId, newMedicine) => {
  try {
    // Fetch all medicines for the user/patient directly from DB to avoid circular imports
    let query = db.collection('medicines').where('userId', '==', userId);
    if (patientId) {
      query = query.where('patientId', '==', patientId);
    }
    const snapshot = await query.get();
    const medicines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // We only care about interactions if there's more than one medicine
    if (medicines.length <= 1) return;

    // Fetch wellness logs for lifestyle factors (alcohol, etc.)
    const wellnessSnapshot = await db.collection('wellness')
      .where('userId', '==', userId)
      .where('patientId', '==', patientId || null)
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get();
    
    const lifestyleFactors = wellnessSnapshot.docs
      .map(doc => doc.data())
      .filter(l => l.type === 'food' || l.type === 'lifestyle')
      .map(l => l.data?.meal || l.data?.notes)
      .filter(Boolean)
      .slice(0, 5);

    const safety = await aiService.checkHolisticSafety(medicines, lifestyleFactors);

    if (safety.interactions && safety.interactions.length > 0) {
      const highRisk = safety.interactions.filter(i => i.risk === 'High' || i.risk === 'Medium');
      
      if (highRisk.length > 0) {
        await sendPushNotification(userId, {
          title: '⚠️ Safety Alert',
          body: `We found potential interactions with ${newMedicine.name}. Tap to see safety advice.`,
          data: { type: 'safety_alert', interactions: highRisk }
        });
        console.log(`[Autonomous] Safety alert sent to ${userId} for ${newMedicine.name}`);
      }
    }
  } catch (err) {
    console.error('[Autonomous] Medicine safety interception failed:', err.message);
  }
};

/**
 * 2. Real-time Meal Interaction Monitor
 * Runs after a meal is logged to check for instant interactions.
 */
export const interceptMealSafety = async (userId, patientId, mealDescription) => {
  try {
    let query = db.collection('medicines').where('userId', '==', userId);
    if (patientId) {
      query = query.where('patientId', '==', patientId);
    }
    const snapshot = await query.get();
    const medicines = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (medicines.length === 0) return;

    const safety = await aiService.checkMealSafety(medicines, mealDescription);

    if (safety.risk && safety.risk !== 'Safe') {
      await sendPushNotification(userId, {
        title: '🍽️ Meal Safety Warning',
        body: `Your meal "${mealDescription}" might interact with your meds. ${safety.explanation}`,
        data: { type: 'meal_safety', safety }
      });
      console.log(`[Autonomous] Meal safety warning sent to ${userId} for: ${mealDescription}`);
    }
  } catch (err) {
    console.error('[Autonomous] Meal safety interception failed:', err.message);
  }
};

/**
 * 3. Critical Adherence Intervention
 * Monitors for consecutive misses of critical medications.
 */
export const interceptCriticalAdherence = async (userId, patientId, medicineId, logAction) => {
  if (logAction !== 'skipped' && logAction !== 'missed') return;

  try {
    const medDoc = await db.collection('medicines').doc(medicineId).get();
    if (!medDoc.exists) return;
    const medicine = medDoc.data();

    // Identify critical meds (Heart, BP, HIV, Diabetes, etc.)
    const criticalKeywords = ['heart', 'blood pressure', 'bp', 'hiv', 'arv', 'insulin', 'diabetes', 'seizure', 'epilepsy'];
    const isCritical = criticalKeywords.some(kw => 
      medicine.name.toLowerCase().includes(kw) || 
      (medicine.genericName && medicine.genericName.toLowerCase().includes(kw)) ||
      (medicine.notes && medicine.notes.toLowerCase().includes(kw))
    );

    if (!isCritical) return;

    // Check last 2 logs for this medicine
    const logsSnapshot = await db.collection('doseLogs')
      .where('userId', '==', userId)
      .where('medicineId', '==', medicineId)
      .orderBy('actionTime', 'desc')
      .limit(2)
      .get();
    
    const medLogs = logsSnapshot.docs.map(doc => doc.data());

    // If last two logs are both negative (skipped/missed)
    const consecutiveMisses = medLogs.length >= 2 && medLogs.every(l => l.action === 'skipped' || l.action === 'missed');

    if (consecutiveMisses) {
      await sendPushNotification(userId, {
        title: '❤️ Compassionate Check-in',
        body: `We noticed you've missed your last few doses of ${medicine.name}. Is everything okay? Your health is our priority.`,
        data: { type: 'adherence_intervention', medicineId }
      });
      console.log(`[Autonomous] Critical adherence intervention sent to ${userId} for ${medicine.name}`);
    }
  } catch (err) {
    console.error('[Autonomous] Critical adherence interception failed:', err.message);
  }
};

/**
 * 5. Smart Timezone Adaptation
 * Triggered when a timezone change is detected.
 */
export const interceptTimezoneChange = async (userId, newTimezone, currentCity = 'Unknown') => {
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return;
    const userData = userDoc.data();
    
    // Only proceed if timezone actually changed
    if (userData.lastTimezone === newTimezone) return;

    const medSnapshot = await db.collection('medicines').where('userId', '==', userId).get();
    const medicines = medSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (medicines.length === 0) return;

    const travelAdvice = await aiService.getTravelAdvice({
      medicines,
      destination: currentCity,
      homeTimezone: userData.lastTimezone || 'UTC',
      targetTimezone: newTimezone
    });

    await sendPushNotification(userId, {
      title: `🌏 Welcome to ${currentCity}!`,
      body: `Your medication schedule might need adjustment. ${travelAdvice.timezoneAdvice.slice(0, 100)}...`,
      data: { type: 'travel_adjustment', travelAdvice }
    });

    // Update last known timezone
    await db.collection('users').doc(userId).update({ lastTimezone: newTimezone });
    console.log(`[Autonomous] Timezone adaptation sent to ${userId} for ${newTimezone}`);
  } catch (err) {
    console.error('[Autonomous] Timezone adaptation failed:', err.message);
  }
};
