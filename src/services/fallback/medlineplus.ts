import { DrugInformation } from '../../types/api';

export const fetchFromMedlinePlus = async (query: string): Promise<DrugInformation | null> => {
  try {
    // MedlinePlus Connect usually requires an NDC, RxCUI, or ICD-9/10 code for precise lookup.
    // For free-text searching, we use the MedlinePlus web service search API.
    const response = await fetch(`https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&term=${encodeURIComponent(query)}&retmax=1`);
    if (!response.ok) return null;
    
    const text = await response.text();
    // Responses are in XML. We'll do a basic string extraction for the mock since we don't have an XML parser by default.
    // In a production app, use DOMParser or an xml-to-json library.
    const titleMatch = text.match(/<content name="title">([^<]+)<\/content>/);
    const summaryMatch = text.match(/<content name="FullSummary">([^<]+)<\/content>/);
    
    if (!titleMatch) return null;
    
    return {
      id: `medline-${Date.now()}`,
      name: titleMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
      indications: summaryMatch ? summaryMatch[1].replace(/&lt;[^&]*&gt;/g, '') : undefined, // Strip simple HTML
      source: "MEDLINEPLUS"
    };
  } catch (error) {
    console.warn("MedlinePlus fallback failed:", error);
    return null;
  }
}
