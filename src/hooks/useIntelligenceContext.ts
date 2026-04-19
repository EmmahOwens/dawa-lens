import { useState, useEffect } from "react";
import { aiApi } from "@/services/api";
import { useApp } from "@/contexts/AppContext";

export function useIntelligenceContext() {
  const { medicines, doseLogs, userProfile } = useApp();
  const [insight, setInsight] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchInsight() {
      if (medicines.length === 0) {
        setInsight(null);
        return;
      }
      
      setIsLoading(true);
      try {
        // We use getCoachAdvice or a chat completion to get a quick summary insight
        const res = await aiApi.getCoachAdvice({
          logs: doseLogs.slice(0, 10),
          medicines,
          userName: userProfile?.name
        });
        
        if (res && res.advice) {
          // Extract a short snippet or just use the advice directly
          setInsight(res.advice);
        }
      } catch (err) {
        console.error("Failed to fetch intelligence context:", err);
        setInsight(null);
      } finally {
        setIsLoading(false);
      }
    }

    // Only run if we have some data and a reasonable amount of time has passed 
    // or just run it when medicines change.
    const debounceTimeout = setTimeout(() => {
      fetchInsight();
    }, 1500);

    return () => clearTimeout(debounceTimeout);
  }, [medicines, doseLogs, userProfile?.name]);

  return {
    insight,
    isLoading
  };
}
