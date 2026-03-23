import admin, { type ServiceAccount } from 'firebase-admin';
import { existsSync, readFileSync } from 'fs';
import { Agent } from 'https';
import { resolve } from 'path';

export interface IPushNotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
  imageUrl?: string
}

export interface IPushNotificationResult {
  success: boolean
  messageId?: string
  error?: string
}

let firebaseApp: admin.app.App | null = null;
let isInitialized = false;

/**
 * Reset Firebase app (useful for testing or re-initialization)
 */
export const resetFirebaseApp = async (): Promise<void> => {
  if (firebaseApp) {
    try {
      await firebaseApp.delete();
    } catch {
      // Ignore errors during deletion
    }
    firebaseApp = null;
    isInitialized = false;
  }
};

/**
 * Initialize Firebase Admin SDK
 * Supports two methods:
 * 1. Service account JSON file (set FIREBASE_SERVICE_ACCOUNT_PATH env var)
 * 2. Individual environment variables (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL)
 */
export const initializeFirebase = (): admin.app.App => {
  if (firebaseApp && isInitialized) {
    console.log('[Firebase] Returning cached Firebase app');
    return firebaseApp;
  }

  // Check if Firebase is already initialized by admin SDK
  try {
    const existingApp = admin.app();
    if (existingApp) {
      console.log('[Firebase] Using existing Firebase app from admin SDK');
      firebaseApp = existingApp;
      isInitialized = true;
      return firebaseApp;
    }
  } catch {
    // No existing app, continue with initialization
    console.log('[Firebase] No existing app, initializing new one...');
  }

  let credential: admin.credential.Credential;

  // Method 1: Use service account JSON file
  const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
  if (serviceAccountPath) {
    // Try multiple path resolutions
    let absolutePath = resolve(serviceAccountPath);
    console.log('[Firebase] Trying path:', absolutePath);

    // If not found, try relative to current working directory
    if (!existsSync(absolutePath)) {
      absolutePath = resolve(process.cwd(), serviceAccountPath);
      console.log('[Firebase] Trying cwd path:', absolutePath);
    }

    // If still not found, try relative to __dirname equivalent
    if (!existsSync(absolutePath)) {
      const dirname = new URL('.', import.meta.url).pathname;
      absolutePath = resolve(dirname, '../../..', serviceAccountPath);
      console.log('[Firebase] Trying dirname path:', absolutePath);
    }

    if (!existsSync(absolutePath)) {
      throw new Error(`Firebase service account file not found. Tried paths: ${serviceAccountPath}, ${resolve(process.cwd(), serviceAccountPath)}`);
    }

    console.log('[Firebase] Loading service account from file:', absolutePath);

    try {
      const serviceAccountJson = JSON.parse(readFileSync(absolutePath, 'utf-8'));
      console.log('[Firebase] Initializing with project:', serviceAccountJson.project_id);
      console.log('[Firebase] Client email:', serviceAccountJson.client_email);
      credential = admin.credential.cert(serviceAccountJson);
    } catch (error) {
      throw new Error(`Failed to parse Firebase service account file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    // Method 2: Use individual environment variables
    const serviceAccount: ServiceAccount = {
      projectId: process.env['FIREBASE_PROJECT_ID'],
      privateKey: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
      clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
    };

    // Check if all required credentials are present
    if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
      throw new Error(
        'Firebase credentials are not properly configured. ' +
        'Either set FIREBASE_SERVICE_ACCOUNT_PATH to point to your service account JSON file, ' +
        'or set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL environment variables.',
      );
    }

    console.log('[Firebase] Initializing with project:', serviceAccount.projectId);
    console.log('[Firebase] Client email:', serviceAccount.clientEmail);
    credential = admin.credential.cert(serviceAccount);
  }

  // Create custom HTTP agent with longer timeout
  const httpAgent = new Agent({
    keepAlive: true,
    timeout: 60000, // 60 seconds
  });

  firebaseApp = admin.initializeApp({
    credential,
    httpAgent,
  });
  isInitialized = true;

  console.log('[Firebase] Firebase app initialized successfully with custom HTTP agent');
  return firebaseApp;
};

/**
 * Get Firebase Admin instance
 */
export const getFirebaseApp = (): admin.app.App => {
  if (!firebaseApp) {
    return initializeFirebase();
  }
  return firebaseApp;
};

/**
 * Get OAuth2 access token for FCM HTTP v1 API
 */
const getAccessToken = async (): Promise<string> => {
  const app = getFirebaseApp();
  const token = await app.options.credential?.getAccessToken();
  if (!token?.access_token) {
    throw new Error('Failed to get access token');
  }
  return token.access_token;
};

/**
 * Send push notification using native fetch API (FCM HTTP v1 API)
 * This bypasses the firebase-admin SDK's HTTP client which may have issues with Bun
 */
export const sendPushNotificationNative = async (
  fcmToken: string,
  payload: IPushNotificationPayload,
): Promise<IPushNotificationResult> => {
  try {
    console.log('[Firebase Native] Getting access token...');
    const accessToken = await getAccessToken();

    const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
    let projectId = process.env['FIREBASE_PROJECT_ID'];

    if (serviceAccountPath) {
      const absolutePath = resolve(serviceAccountPath);
      const serviceAccountJson = JSON.parse(readFileSync(absolutePath, 'utf-8'));
      projectId = serviceAccountJson.project_id;
    }

    if (!projectId) {
      throw new Error('Firebase project ID not found');
    }

    console.log('[Firebase Native] Sending to FCM HTTP v1 API...');
    console.log('[Firebase Native] Project ID:', projectId);
    console.log('[Firebase Native] Token:', fcmToken.substring(0, 30) + '...');

    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const message = {
      message: {
        token: fcmToken,
        notification: {
          title: payload.title,
          body: payload.body,
          image: payload.imageUrl,
        },
        data: payload.data,
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            click_action: 'FLUTTER_NOTIFICATION_CLICK',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const responseData = await response.json() as { name?: string; error?: { message?: string; code?: number } };

    if (!response.ok) {
      console.error('[Firebase Native] Error response:', responseData);
      return {
        success: false,
        error: responseData.error?.message || `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    console.log('[Firebase Native] Success:', responseData);
    return {
      success: true,
      messageId: responseData.name,
    };
  } catch (error) {
    console.error('[Firebase Native] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Send push notification to a single device
 * @param fcmToken - Firebase Cloud Messaging token of the target device
 * @param payload - Notification payload containing title, body, and optional data
 * @param dryRun - If true, validates the message without actually sending it
 * @param useNative - If true, uses native fetch API instead of firebase-admin SDK
 */
export const sendPushNotification = async (
  fcmToken: string,
  payload: IPushNotificationPayload,
  dryRun: boolean = false,
  useNative: boolean = true, // Default to native fetch API
): Promise<IPushNotificationResult> => {
  // Use native fetch API by default to avoid Bun compatibility issues
  if (useNative && !dryRun) {
    return sendPushNotificationNative(fcmToken, payload);
  }

  try {
    console.log('[Firebase] Initializing Firebase app...');
    const app = getFirebaseApp();
    const messaging = app.messaging();

    console.log('[Firebase] Preparing message for token:', fcmToken);
    console.log('[Firebase] Dry run mode:', dryRun);

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: payload.imageUrl,
      },
      data: payload.data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    console.log('[Firebase] Sending push notification...');
    const response = await messaging.send(message, dryRun);
    console.log('[Firebase] Push notification sent successfully:', response);

    return {
      success: true,
      messageId: response,
    };
  } catch (error) {
    console.error('[Firebase] Error sending push notification:', error);

    // Extract error code from Firebase error
    const firebaseError = error as { code?: string; errorInfo?: { code?: string; message?: string } };
    const errorCode = firebaseError.errorInfo?.code || firebaseError.code || '';
    const errorMsg = firebaseError.errorInfo?.message || (error instanceof Error ? error.message : 'Unknown error');

    console.error('[Firebase] Error code:', errorCode);
    console.error('[Firebase] Error message:', errorMsg);

    // Handle specific Firebase messaging errors
    if (errorCode.includes('messaging/invalid-registration-token') ||
        errorCode.includes('messaging/registration-token-not-registered') ||
        errorMsg.includes('not a valid FCM registration token')) {
      return {
        success: false,
        error: 'FCM token is invalid or expired. User needs to re-register their device.',
      };
    }

    if (errorCode.includes('messaging/invalid-argument') ||
        errorMsg.includes('not a valid FCM registration token')) {
      return {
        success: false,
        error: 'FCM token is not valid. The token format is incorrect or the token has expired.',
      };
    }

    if (errorCode.includes('app/network-timeout') || errorMsg.includes('timeout')) {
      return {
        success: false,
        error: 'Connection to Firebase timed out. Please check your network connection and Firebase configuration.',
      };
    }

    if (errorCode.includes('messaging/mismatched-credential')) {
      return {
        success: false,
        error: 'The FCM token was generated for a different Firebase project. Please check your Firebase configuration.',
      };
    }

    return {
      success: false,
      error: errorMsg,
    };
  }
};

/**
 * Send push notification to multiple devices
 * @param fcmTokens - Array of Firebase Cloud Messaging tokens
 * @param payload - Notification payload containing title, body, and optional data
 */
export const sendPushNotificationToMultiple = async (
  fcmTokens: string[],
  payload: IPushNotificationPayload,
): Promise<{ successCount: number; failureCount: number; results: IPushNotificationResult[] }> => {
  const results: IPushNotificationResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const token of fcmTokens) {
    const result = await sendPushNotification(token, payload);
    results.push(result);
    if (result.success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  return {
    successCount,
    failureCount,
    results,
  };
};
