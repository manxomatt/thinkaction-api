import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

export interface IFirebaseConfig {
  serviceAccountPath?: string
  projectId?: string
  privateKey?: string
  clientEmail?: string
}

// Get configuration from environment variables
const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
const projectId = process.env['FIREBASE_PROJECT_ID'];
const privateKey = process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n');
const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];

export const firebaseConfig: IFirebaseConfig = {
  serviceAccountPath,
  projectId,
  privateKey,
  clientEmail,
};

let firebaseApp: admin.app.App | null = null;

/**
 * Initialize Firebase Admin SDK
 * Supports two methods:
 * 1. Service account JSON file (recommended for development)
 * 2. Individual environment variables (recommended for production)
 */
export const initializeFirebase = (): admin.app.App | null => {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Method 1: Use service account JSON file
    if (serviceAccountPath) {
      const absolutePath = path.resolve(serviceAccountPath);

      if (fs.existsSync(absolutePath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));

        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        console.log('[Firebase] Initialized with service account file');
        return firebaseApp;
      } else {
        console.warn(`[Firebase] Service account file not found at: ${absolutePath}`);
      }
    }

    // Method 2: Use individual environment variables
    if (projectId && privateKey && clientEmail) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          privateKey,
          clientEmail,
        }),
      });

      console.log('[Firebase] Initialized with environment variables');
      return firebaseApp;
    }

    console.warn('[Firebase] No valid configuration found. FCM push notifications will be disabled.');
    return null;
  } catch (error) {
    console.error('[Firebase] Failed to initialize:', error);
    return null;
  }
};

/**
 * Get Firebase Admin instance
 */
export const getFirebaseApp = (): admin.app.App | null => {
  if (!firebaseApp) {
    return initializeFirebase();
  }
  return firebaseApp;
};

/**
 * Get Firebase Messaging instance
 */
export const getMessaging = (): admin.messaging.Messaging | null => {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }
  return admin.messaging(app);
};

export default firebaseConfig;
