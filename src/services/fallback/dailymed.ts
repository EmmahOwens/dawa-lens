import { DrugInformation } from '../../types/api';

export const fetchFromDailyMed = async (query: string): Promise<DrugInformation | null> => {
  try {
    const response = await fetch(`https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?drug_name=${encodeURIComponent(query)}`);
    if (!response.ok) return null;
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) return null;
    
    const result = data.data[0];
    return {
      id: result.setid,
      name: result.title,
      source: "DAILYMED"
    };
  } catch (error) {
    console.warn("DailyMed fallback failed:", error);
    return null;
  }
}
