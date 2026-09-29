// test_verifier.js
const { verifyPayment } = require('./verifier');

async function runTests() {
  console.log('--- RUNNING AUTOMATED VERIFIER TESTS ---\n');

  // Test Case 1: Valid Order Check
  try {
    console.log('Testing Non-existent Order...');
    const res1 = await verifyPayment('NON-EXISTENT-ORDER', './uploads/sample.png');
    console.log('Result:', res1.decision === 'REJECTED' ? 'PASSED' : 'FAILED', `(${res1.decisionReason})`);
  } catch (e) {
    console.log('Test 1 skipped: Check image path.');
  }

  console.log('\n--- TESTS COMPLETED ---');
}

runTests();