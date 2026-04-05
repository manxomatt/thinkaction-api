import type { BatchResponse,Message, MulticastMessage } from 'firebase-admin/messaging';

import { getMessaging } from '@/config/firebase';

export interface IFcmNotificationPayload {
  title: string
  body: string
  imageUrl?: string
}

export interface IFcmDataPayload {
  [key: string]: string
}

export interface ISendToTokenInput {
  token: string
  notification: IFcmNotificationPayload
  data?: IFcmDataPayload
}

export interface ISendToTokensInput {
  tokens: string[]
  notification: IFcmNotificationPayload
  data?: IFcmDataPayload
}

export interface ISendToTopicInput {
  topic: string
  notification: IFcmNotificationPayload
  data?: IFcmDataPayload
}

export interface IFcmSendResult {
  success: boolean
  messageId?: string
  error?: string
}

export interface IFcmMulticastResult {
  successCount: number
  failureCount: number
  responses: IFcmSendResult[]
}

export interface IFcmService {
  sendToToken(input: ISendToTokenInput): Promise<IFcmSendResult>
  sendToTokens(input: ISendToTokensInput): Promise<IFcmMulticastResult>
  sendToTopic(input: ISendToTopicInput): Promise<IFcmSendResult>
  isAvailable(): boolean
}

/**
 * FCM Service for sending push notifications via Firebase Cloud Messaging
 */
export const FcmService: IFcmService = {
  /**
   * Check if FCM is available (Firebase is initialized)
   */
  isAvailable(): boolean {
    return getMessaging() !== null;
  },

  /**
   * Send notification to a single device token
   */
  async sendToToken(input: ISendToTokenInput): Promise<IFcmSendResult> {
    const messaging = getMessaging();

    if (!messaging) {
      console.warn('[FCM] Firebase not initialized, skipping push notification');
      return {
        success: false,
        error: 'Firebase not initialized',
      };
    }

    try {
      const message: Message = {
        token: input.token,
        notification: {
          title: input.notification.title,
          body: input.notification.body,
          imageUrl: input.notification.imageUrl,
        },
        data: input.data,
        // Android specific configuration
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FCM_PLUGIN_ACTIVITY',
          },
        },
        // iOS specific configuration
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        // Web push configuration
        webpush: {
          notification: {
            icon: '/icon.png',
          },
        },
      };

      const messageId = await messaging.send(message);

      console.log(`[FCM] Successfully sent message: ${messageId}`);

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FCM] Error sending message:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  },

  /**
   * Send notification to multiple device tokens
   */
  async sendToTokens(input: ISendToTokensInput): Promise<IFcmMulticastResult> {
    const messaging = getMessaging();

    if (!messaging) {
      console.warn('[FCM] Firebase not initialized, skipping push notification');
      return {
        successCount: 0,
        failureCount: input.tokens.length,
        responses: input.tokens.map(() => ({
          success: false,
          error: 'Firebase not initialized',
        })),
      };
    }

    if (input.tokens.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        responses: [],
      };
    }

    try {
      const message: MulticastMessage = {
        tokens: input.tokens,
        notification: {
          title: input.notification.title,
          body: input.notification.body,
          imageUrl: input.notification.imageUrl,
        },
        data: input.data,
        // Android specific configuration
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FCM_PLUGIN_ACTIVITY',
          },
        },
        // iOS specific configuration
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        // Web push configuration
        webpush: {
          notification: {
            icon: '/icon.png',
          },
        },
      };

      const response: BatchResponse = await messaging.sendEachForMulticast(message);

      console.log(`[FCM] Multicast result: ${response.successCount} success, ${response.failureCount} failure`);

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        responses: response.responses.map((res) => ({
          success: res.success,
          messageId: res.messageId,
          error: res.error?.message,
        })),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FCM] Error sending multicast message:', errorMessage);

      return {
        successCount: 0,
        failureCount: input.tokens.length,
        responses: input.tokens.map(() => ({
          success: false,
          error: errorMessage,
        })),
      };
    }
  },

  /**
   * Send notification to a topic
   */
  async sendToTopic(input: ISendToTopicInput): Promise<IFcmSendResult> {
    const messaging = getMessaging();

    if (!messaging) {
      console.warn('[FCM] Firebase not initialized, skipping push notification');
      return {
        success: false,
        error: 'Firebase not initialized',
      };
    }

    try {
      const message: Message = {
        topic: input.topic,
        notification: {
          title: input.notification.title,
          body: input.notification.body,
          imageUrl: input.notification.imageUrl,
        },
        data: input.data,
        // Android specific configuration
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FCM_PLUGIN_ACTIVITY',
          },
        },
        // iOS specific configuration
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const messageId = await messaging.send(message);

      console.log(`[FCM] Successfully sent topic message: ${messageId}`);

      return {
        success: true,
        messageId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[FCM] Error sending topic message:', errorMessage);

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
};
