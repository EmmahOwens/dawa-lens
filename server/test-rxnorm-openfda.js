import * as openFdaService from './src/services/openFdaService.js';
import * as rxNormService from './src/services/rxNormService.js';

async function runTests() {
  console.log('🧪 Testing RxNorm & openFDA Unified Pipeline...\n');

  // Test 1: RxNorm Concept Resolution for International / Regional Names
  console.log('1. Testing RxNorm Concept Resolution:');
  const testDrugs = ['Panadol', 'Salbutamol', 'Co-amoxiclav', 'Frusemide', 'Coartem', 'Augmentin'];

  for (const drug of testDrugs) {
    const concept = await rxNormService.resolveRxNormConcept(drug);
    if (concept) {
      console.log(`  ✅ ${drug} -> RxCUI: ${concept.rxcui} | USAN Canonical: "${concept.canonicalName}" | Ingredients: [${concept.activeIngredients.join(', ')}]`);
    } else {
      console.log(`  ⚠️ ${drug} -> Could not resolve in RxNorm`);
    }
  }

  // Test 2: openFDA Label Fetching for Regional Name (Panadol -> Acetaminophen)
  console.log('\n2. Testing openFDA Label Retrieval for "Panadol" (via RxNorm):');
  const label = await openFdaService.fetchDrugLabel('Panadol');
  if (label) {
    console.log('  ✅ Fetched Label for Panadol:', {
      brandName: label.brandName,
      genericName: label.genericName,
      rxcui: label.rxcui,
      hasBoxedWarning: !!label.boxedWarning,
      hasIndications: !!label.indicationsAndUsage,
    });
  } else {
    console.log('  ⚠️ No label returned for Panadol');
  }

  // Test 3: openFDA Label Fetching for "Salbutamol" (via RxNorm -> Albuterol)
  console.log('\n3. Testing openFDA Label Retrieval for "Salbutamol":');
  const salbutamolLabel = await openFdaService.fetchDrugLabel('Salbutamol');
  if (salbutamolLabel) {
    console.log('  ✅ Fetched Label for Salbutamol:', {
      brandName: salbutamolLabel.brandName,
      genericName: salbutamolLabel.genericName,
      rxcui: salbutamolLabel.rxcui,
      hasIndications: !!salbutamolLabel.indicationsAndUsage,
    });
  } else {
    console.log('  ⚠️ No label returned for Salbutamol');
  }

  // Test 4: Comprehensive Drug Profile with Patient Context
  console.log('\n4. Testing Comprehensive Drug Profile for "Co-amoxiclav":');
  const profile = await openFdaService.getComprehensiveDrugProfile('Co-amoxiclav', {
    age: 35,
    gender: 'female',
    conditions: ['Asthma'],
    allergies: ['Penicillin'],
  });

  console.log('  ✅ Profile Result:', {
    query: profile.query,
    resolvedName: profile.resolvedName,
    rxcui: profile.rxcui,
    activeIngredients: profile.activeIngredients,
    trustIndexScore: profile.trustIndex?.score,
    allergenAlertsCount: profile.safetyAlerts?.allergenAlerts?.length,
  });

  // Test 5: Spelling suggestions
  console.log('\n5. Testing RxNorm Spelling Suggestions for "paracetmol":');
  const suggestions = await rxNormService.getSpellingSuggestions('paracetmol');
  console.log('  ✅ Suggestions:', suggestions);

  console.log('\n🎉 RxNorm & openFDA Unified Pipeline Test Completed Successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
