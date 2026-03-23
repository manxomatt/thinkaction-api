// Test script to send actual FCM notification with real token
// Run with: bun run test-fcm-real.ts

import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const testFcmSend = async () => {
  console.log('=== FCM Real Send Test ===\n');

  // Load service account
  const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
  if (!serviceAccountPath) {
    console.error('FIREBASE_SERVICE_ACCOUNT_PATH not set');
    process.exit(1);
  }

  const absolutePath = resolve(serviceAccountPath);
  console.log('Loading service account from:', absolutePath);

  if (!existsSync(absolutePath)) {
    console.error('File not found:', absolutePath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(readFileSync(absolutePath, 'utf-8'));
  console.log('Project ID:', serviceAccount.project_id);

  // Initialize Firebase
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const messaging = app.messaging();

  // Use the real FCM token that works from Firebase dashboard
  const fcmToken = 'dGB1z9iVSX-JNjjVcheIh4:APA91bF4Syn_p-JJm9cDlOxBjg9AIEBunV3LyMm5KiinfmyqU5DHGwnLY2GBR6fPqFUKEqZYh-8QTE7JrQv_rtW5blTK4WRqq-cYyTtq11Io8GM7FAgXOMs';

  console.log('\nSending to FCM token:', fcmToken.substring(0, 30) + '...');

  const message = {
    token: fcmToken,
    notification: {
      title: 'Test from API',
      body: 'This is a test notification from ThinkAction API',
    },
    data: {
      type: 'test',
      timestamp: new Date().toISOString(),
    },
  };

  console.log('\nMessage:', JSON.stringify(message, null, 2));

  try {
    console.log('\nSending notification...');
    const startTime = Date.now();

    const response = await messaging.send(message);

    const endTime = Date.now();
    console.log(`\n✓ Success! (${endTime - startTime}ms)`);
    console.log('Message ID:', response);
  } catch (error) {
    console.error('\n✗ Error:', error);

    if (error instanceof Error) {
      console.error('Error message:', error.message);

      // Check error code
      const firebaseError = error as { code?: string; errorInfo?: { code?: string } };
      if (firebaseError.code) {
        console.error('Error code:', firebaseError.code);
      }
      if (firebaseError.errorInfo?.code) {
        console.error('Firebase error code:', firebaseError.errorInfo.code);
      }
    }
  }

  await app.delete();
  console.log('\n=== Test Complete ===');
};

testFcmSend();
