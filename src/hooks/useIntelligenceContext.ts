import { useState, useEffect } from "react";
import { aiApi } from "@/services/api";
import { useApp } from "@/contexts/AppContext";

export function useIntelligenceContext() {
  const { medicines, doseLogs, userProfile } = useApp();
  const [insight, setInsight] = useState<string | null>(null);
  const [nutritionalTip, setNutritionalTip] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchInsights() {
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
        }

        if (nutritionRes && nutritionRes.warnings?.length > 0) {
          setNutritionalTip(`Safety Warning: ${nutritionRes.warnings[0].explanation}`);
        } else if (nutritionRes && nutritionRes.recommendations?.length > 0) {
          setNutritionalTip(`Meal Tip: ${nutritionRes.recommendations[0].food} - ${nutritionRes.recommendations[0].benefit}`);
        }
      } catch (err) {
        console.error("Failed to fetch intelligence context:", err);
        setInsight(null);
        setNutritionalTip(null);
      } finally {
        setIsLoading(false);
      }
    }

    const debounceTimeout = setTimeout(() => {
      fetchInsights();
    }, 1500);

    return () => clearTimeout(debounceTimeout);
  }, [medicines, doseLogs, userProfile?.name]);

  return {
    insight,
    nutritionalTip,
    isLoading
  };
}
