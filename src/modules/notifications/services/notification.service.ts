import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import { FcmService, type IFcmService } from '@/modules/fcm/services/fcm.service';
import type { IRetrieveFcmTokensRepository } from '@/modules/users/repositories/retrieve-fcm-tokens.repository';

import type { ICreateRepository } from '../repositories/create.repository';

export type NotificationType = 'support' | 'unsupport' | 'cheers' | 'comment' | 'mention' | 'comment-replied' | 'goal-failed'

export interface INotificationTemplate {
  type: NotificationType
  notification: string
  title: string
}

export interface INotificationService {
  handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed>
  getTemplate(type: NotificationType, payload: Record<string, string>): string
  getTitle(type: NotificationType): string
}


export const notificationTemplate: INotificationTemplate[] = [
  {
    type: 'support',
    title: 'New Supporter',
    notification: '[username] is supporting you',
  },
  {
    type: 'unsupport',
    title: 'Supporter Update',
    notification: '[username] is no longer supporting you',
  },
  {
    type: 'cheers',
    title: 'New Cheer',
    notification: '[username] is cheering on your goal',
  },
  {
    type: 'comment',
    title: 'New Comment',
    notification: '[username] is commenting on your goal',
  },
  {
    type: 'mention',
    title: 'You were mentioned',
    notification: '[username] is mentioning you in a comment',
  },
  {
    type: 'comment-replied',
    title: 'Comment Reply',
    notification: '[username] replied to your comment',
  },
  {
    type: 'goal-failed',
    title: 'Goal Update',
    notification: 'You failed to achieve your goal',
  },
];

interface IInput {
  data: {
    type?: NotificationType
    actor_id?: string // user who triggered it (friend, commenter, liker)
    recipient_id?: string // user who receives the notification
    message?: string
    entities?: Record<string, string>
    is_read?: boolean
    read_at?: Date
    thumbnail_url?: string
    created_at?: Date
  }
  // Optional: skip FCM push notification
  skipPush?: boolean
}

export interface IDeps {
  createRepository: ICreateRepository
  retrieveFcmTokensRepository?: IRetrieveFcmTokensRepository
  fcmService?: IFcmService
}

export interface ISuccessData {
  inserted_id: string
  fcm_sent?: boolean
  fcm_success_count?: number
  fcm_failure_count?: number
}

export class NotificationService extends BaseUseCase<IInput, IDeps, ISuccessData> implements INotificationService {

  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // 1. Create notification record in database
    const response = await this.deps.createRepository.handle(input.data);

    // 2. Send FCM push notification if not skipped
    let fcmSent = false;
    let fcmSuccessCount = 0;
    let fcmFailureCount = 0;

    if (!input.skipPush && input.data.recipient_id && input.data.type) {
      const fcmResult = await this.sendFcmNotification(input.data);
      fcmSent = fcmResult.sent;
      fcmSuccessCount = fcmResult.successCount;
      fcmFailureCount = fcmResult.failureCount;
    }

    return this.success({
      inserted_id: response.inserted_id,
      fcm_sent: fcmSent,
      fcm_success_count: fcmSuccessCount,
      fcm_failure_count: fcmFailureCount,
    });
  }

  /**
   * Send FCM push notification to recipient's devices
   */
  private async sendFcmNotification(data: IInput['data']): Promise<{
    sent: boolean
    successCount: number
    failureCount: number
  }> {
    // Use injected FCM service or default singleton
    const fcmService = this.deps.fcmService || FcmService;

    // Check if FCM is available
    if (!fcmService.isAvailable()) {
      console.log('[NotificationService] FCM not available, skipping push notification');
      return { sent: false, successCount: 0, failureCount: 0 };
    }

    // Get recipient's FCM tokens
    if (!this.deps.retrieveFcmTokensRepository) {
      console.log('[NotificationService] FCM tokens repository not provided, skipping push notification');
      return { sent: false, successCount: 0, failureCount: 0 };
    }

    const fcmTokens = await this.deps.retrieveFcmTokensRepository.handle(data.recipient_id!);

    if (fcmTokens.length === 0) {
      console.log(`[NotificationService] No FCM tokens found for user ${data.recipient_id}`);
      return { sent: false, successCount: 0, failureCount: 0 };
    }

    // Get notification title and body
    const title = this.getTitle(data.type!);
    const body = data.message || this.getTemplate(data.type!, {});

    // Extract token strings
    const tokens = fcmTokens.map(t => t.token);

    // Build FCM data payload
    const fcmData: Record<string, string> = {
      type: data.type!,
      notification_id: data.entities?.['notification_id'] || '',
    };

    // Add entities to data payload
    if (data.entities) {
      for (const [key, value] of Object.entries(data.entities)) {
        fcmData[key] = value;
      }
    }

    // Send to all tokens
    if (tokens.length === 1) {
      // Single token - use sendToToken
      const result = await fcmService.sendToToken({
        token: tokens[0],
        notification: {
          title,
          body,
          imageUrl: data.thumbnail_url,
        },
        data: fcmData,
      });

      return {
        sent: true,
        successCount: result.success ? 1 : 0,
        failureCount: result.success ? 0 : 1,
      };
    } else {
      // Multiple tokens - use sendToTokens
      const result = await fcmService.sendToTokens({
        tokens,
        notification: {
          title,
          body,
          imageUrl: data.thumbnail_url,
        },
        data: fcmData,
      });

      return {
        sent: true,
        successCount: result.successCount,
        failureCount: result.failureCount,
      };
    }
  }

  getTemplate(type: NotificationType, payload: Record<string, string>) {
    const template = notificationTemplate.find(t => t.type === type);

    if (!template) {
      return '';
    }

    let notification = template.notification;
    for (const key in payload) {
      notification = notification.replace(key, payload[key]);
    }

    return notification;
  }

  getTitle(type: NotificationType): string {
    const template = notificationTemplate.find(t => t.type === type);
    return template?.title || 'ThinkAction';
  }
}
