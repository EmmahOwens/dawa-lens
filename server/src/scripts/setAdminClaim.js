/**
 * One-time bootstrap script to grant admin custom claim to a Firebase user.
 *
 * Usage:
 *   node server/src/scripts/setAdminClaim.js <FIREBASE_UID>
 */

import { authAdmin } from '../db.js';

const uid = process.argv[2];

if (!uid) {
  console.error('❌  Usage: node server/src/scripts/setAdminClaim.js <FIREBASE_UID>');
  console.error('   Find your UID at: Firebase Console → Authentication → Users');
  process.exit(1);
}

try {
  await authAdmin.setCustomUserClaims(uid, { admin: true });
  const user = await authAdmin.getUser(uid);
  console.log(`\n✅  Success! Admin claim granted to: ${user.email || user.uid} (${uid})`);
  console.log('👉  Please sign out and sign back in for the claim to take effect in your Auth token.\n');
  process.exit(0);
} catch (error) {
  console.error('\n❌  Failed to set admin claim:', error.message);
  process.exit(1);
}
