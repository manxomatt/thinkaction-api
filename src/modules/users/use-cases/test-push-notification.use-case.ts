import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import { type IPushNotificationResult,sendPushNotification } from '@/utils/firebase';

import type { IRetrieveByUsernameRepository } from '../repositories/retrieve-by-username.repository';

interface IInput {
  username: string
}

export interface IDeps {
  retrieveByUsernameRepository: IRetrieveByUsernameRepository
}

export interface ISuccessData {
  message: string
  notification_result: IPushNotificationResult
  user: {
    _id: string
    username: string
    name: string
  }
}

/**
 * Use case: Test push notification by sending to a user by username.
 *
 * This endpoint is for testing purposes to verify push notification delivery.
 */
export class TestPushNotificationUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // Retrieve user by username
    const user = await this.deps.retrieveByUsernameRepository.handle(input.username);

    if (!user) {
      return this.fail({
        code: 404,
        message: 'User not found',
        errors: {
          username: ['User with this username does not exist'],
        },
      });
    }

    // Check if user has FCM token
    if (!user.fcm_token) {
      return this.fail({
        code: 400,
        message: 'User does not have FCM token',
        errors: {
          fcm_token: ['User has not registered their device for push notifications'],
        },
      });
    }

    console.log('[TestPushNotification] User found:', user.username);
    console.log('[TestPushNotification] FCM token:', user.fcm_token.substring(0, 30) + '...');
    console.log('[TestPushNotification] FCM token length:', user.fcm_token.length);

    // Send test push notification
    const notificationResult = await sendPushNotification(user.fcm_token, {
      title: 'Test Push Notification',
      body: `Hello ${user.name || user.username}! This is a test X push notification from ThinkAction.`,
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
      },
    });

    if (!notificationResult.success) {
      return this.fail({
        code: 500,
        message: 'Failed to send push notification',
        errors: {
          notification: [notificationResult.error || 'Unknown error occurred'],
        },
      });
    }

    return this.success({
      message: 'Push notification sent successfully',
      notification_result: notificationResult,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
      },
    });
  }
}
