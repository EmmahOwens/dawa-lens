import * as openFdaService from './src/services/openFdaService.js';

async function runTests() {
  console.log('🧪 Testing openFDA Service Functions...\n');

  // Test 1: Regional Synonym Resolution
  console.log('1. Testing Synonym Resolution:');
  const synonyms1 = openFdaService.getSearchTerms('Paracetamol');
  console.log('  Paracetamol ->', synonyms1);
  const synonyms2 = openFdaService.getSearchTerms('Coartem');
  console.log('  Coartem ->', synonyms2);
  const synonyms3 = openFdaService.getSearchTerms('Salbutamol');
  console.log('  Salbutamol ->', synonyms3);

  // Test 2: Label Fetching (Paracetamol / Acetaminophen)
  console.log('\n2. Testing Label Fetching for Paracetamol (Acetaminophen):');
  const label = await openFdaService.fetchDrugLabel('Paracetamol');
  if (label) {
    console.log('  ✅ Fetched Label:', {
      brandName: label.brandName,
      genericName: label.genericName,
      hasBoxedWarning: !!label.boxedWarning,
      hasIndications: !!label.indicationsAndUsage,
      hasStorage: !!label.storageAndHandling,
    });
  } else {
    console.log('  ⚠️ No label returned (may be network-dependent or rate-limited)');
  }

  // Test 3: Boxed Warning Drug (e.g. Ciprofloxacin)
  console.log('\n3. Testing Boxed Warning detection for Ciprofloxacin:');
  const ciproLabel = await openFdaService.fetchDrugLabel('Ciprofloxacin');
  if (ciproLabel) {
    console.log('  ✅ Ciprofloxacin Boxed Warning:', ciproLabel.boxedWarning ? `${ciproLabel.boxedWarning.slice(0, 100)}...` : 'None');
  }

  // Test 4: Allergen and Contraindication matching
  console.log('\n4. Testing Allergen & Contraindication Checks:');
  const dummyLabel = {
    inactiveIngredients: ['lactose monohydrate', 'magnesium stearate', 'corn starch'],
    contraindications: 'Contraindicated in patients with severe asthma and active peptic ulcer disease.',
    warnings: 'May cause severe allergic reactions in patients sensitive to lactose.',
  };
  const allergenConflicts = openFdaService.checkAllergenConflicts(dummyLabel, ['Lactose', 'Peanuts']);
  console.log('  ✅ Allergen Conflicts (Expected Lactose):', allergenConflicts);

  const contraConflicts = openFdaService.checkContraindicationConflicts(dummyLabel, ['Asthma', 'Diabetes']);
  console.log('  ✅ Contraindication Conflicts (Expected Asthma):', contraConflicts);

  // Test 5: Comprehensive Drug Profile
  console.log('\n5. Testing Comprehensive Drug Profile for Ibuprofen:');
  const profile = await openFdaService.getComprehensiveDrugProfile('Ibuprofen', {
    age: 68,
    gender: 'female',
    conditions: ['Peptic Ulcer', 'Hypertension'],
    allergies: ['Aspirin'],
  });
  console.log('  ✅ Resolved Name:', profile.resolvedName);
  console.log('  ✅ Trust Index:', profile.trustIndex);
  console.log('  ✅ Safety Alerts Count:', {
    hasBoxedWarning: !!profile.safetyAlerts.boxedWarning,
    allergenAlerts: profile.safetyAlerts.allergenAlerts.length,
    contraindicationAlerts: profile.safetyAlerts.contraindicationAlerts.length,
    hasRecalls: profile.safetyAlerts.hasActiveRecalls,
  });

  console.log('\n🎉 openFDA Service Test Suite Finished Successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
