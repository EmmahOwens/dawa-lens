/**
 * Attempts to resolve a known package barcode (UPC/NDC/EAN) to a drug name.
 * We query openFDA's endpoint using the packaging upc code.
 */
export async function resolveBarcodeToDrugName(barcode: string): Promise<string | null> {
  try {
    // openFDA provides packaging.package_ndc or unapproved_prescription_active_ingredients etc
    // easiest is global search for the literal barcode.
    // However, if it's a UPC on a drug, `upc` is a registered field in openfda.
    const res = await fetch(`https://api.fda.gov/drug/ndc.json?search=packaging.upc:"${barcode}"&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const drugInfo = data.results[0];
      return drugInfo.brand_name || drugInfo.generic_name || null;
    }
  } catch (error) {
    console.error("Failed openfda barcode resolution:", error);
  }
  return null;
}
