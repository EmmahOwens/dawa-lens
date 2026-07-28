import { useState, useEffect } from "react";
import { aiApi } from "@/services/api";
import { useApp } from "@/contexts/AppContext";

export function useIntelligenceContext() {
  const { medicines, doseLogs, userProfile } = useApp();
  const [insight, setInsight] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("dawa_coach_advice");
    } catch {
      return null;
    }
  });
  const [nutritionalTip, setNutritionalTip] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem("dawa_intelligence_nutrition");
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchInsights() {
      const cachedInsight = (() => {
        try {
          return sessionStorage.getItem("dawa_coach_advice");
        } catch {
          return null;
        }
      })();

      const cachedNutrition = (() => {
        try {
          return sessionStorage.getItem("dawa_intelligence_nutrition");
        } catch {
          return null;
        }
      })();

      if (cachedInsight || cachedNutrition) {
        if (cachedInsight) setInsight(cachedInsight);
        if (cachedNutrition) setNutritionalTip(cachedNutrition);
        return;
      }

      if (medicines.length === 0) {
        setInsight(null);
        setNutritionalTip(null);
        return;
      }
      
      setIsLoading(true);
      try {
        // Fetch coach advice and nutritional guidance in parallel
        const [coachRes, nutritionRes] = await Promise.all([
          aiApi.getCoachAdvice({
            logs: doseLogs.slice(0, 10),
            medicines,
            userName: userProfile?.name
          }),
          aiApi.getNutritionalGuidance({ medicines })
        ]);
        
        if (coachRes && coachRes.advice) {
          setInsight(coachRes.advice);
          try {
            sessionStorage.setItem("dawa_coach_advice", coachRes.advice);
          } catch (e) {
            console.error("Failed to save coach advice to sessionStorage", e);
          }
        }

        let nutTip: string | null = null;
        if (nutritionRes && nutritionRes.warnings?.length > 0) {
          nutTip = `Safety Warning: ${nutritionRes.warnings[0].explanation}`;
        } else if (nutritionRes && nutritionRes.recommendations?.length > 0) {
          nutTip = `Meal Tip: ${nutritionRes.recommendations[0].food} - ${nutritionRes.recommendations[0].benefit}`;
        }

        if (nutTip) {
          setNutritionalTip(nutTip);
          try {
            sessionStorage.setItem("dawa_intelligence_nutrition", nutTip);
          } catch (e) {
            console.error("Failed to save intelligence nutrition to sessionStorage", e);
          }
        }
      } catch (err) {
        console.error("Failed to fetch intelligence context:", err);
      } finally {
        setIsLoading(false);
      }
    }

    const debounceTimeout = setTimeout(() => {
      fetchInsights();
    }, 1500);

    return () => clearTimeout(debounceTimeout);
  }, []);

  return {
    insight,
    nutritionalTip,
    isLoading
  };
}
