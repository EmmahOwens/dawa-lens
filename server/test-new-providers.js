import dotenv from 'dotenv';
import {
  testAllAiProviders,
  testNvidiaNimProvider,
  testSiliconFlowProvider,
  testZaiProvider
} from './src/services/aiService.js';
import { testVoyageAiProvider } from './src/services/vectorService.js';

dotenv.config();

console.log('====================================================');
console.log('🧪 Testing AI Service Zero-Payment Providers Setup');
console.log('====================================================\n');

(async () => {
  // 1. Overall Provider Configuration Map
  console.log('1️⃣ Checking Provider Configuration Matrix...');
  try {
    const allProviders = await testAllAiProviders();
    console.log(JSON.stringify(allProviders, null, 2));
  } catch (err) {
    console.error('❌ testAllAiProviders failed:', err.message);
  }

  console.log('\n2️⃣ Testing NVIDIA NIM Provider Diagnostic...');
  try {
    const nvidiaRes = await testNvidiaNimProvider();
    console.log('NVIDIA NIM Result:', JSON.stringify(nvidiaRes, null, 2));
  } catch (err) {
    console.error('❌ NVIDIA NIM Diagnostic error:', err.message);
  }

  console.log('\n3️⃣ Testing SiliconFlow Provider Diagnostic...');
  try {
    const siliconRes = await testSiliconFlowProvider();
    console.log('SiliconFlow Result:', JSON.stringify(siliconRes, null, 2));
  } catch (err) {
    console.error('❌ SiliconFlow Diagnostic error:', err.message);
  }

  console.log('\n4️⃣ Testing Voyage AI Provider Diagnostic...');
  try {
    const voyageRes = await testVoyageAiProvider();
    console.log('Voyage AI Result:', JSON.stringify(voyageRes, null, 2));
  } catch (err) {
    console.error('❌ Voyage AI Diagnostic error:', err.message);
  }

  console.log('\n====================================================');
  console.log('✅ Diagnostic check finished.');
  console.log('====================================================');
})();
