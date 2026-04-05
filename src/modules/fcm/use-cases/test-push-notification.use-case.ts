import type { IDatabase } from '@point-hub/papi';

import { collectionName as usersCollectionName } from '@/modules/users/entity';
import type { IFcmToken, IUserEntity } from '@/modules/users/interface';

import { FcmService, type IFcmMulticastResult } from '../services/fcm.service';

export interface ITestPushNotificationInput {
  username: string
}

export interface ITestPushNotificationOutput {
  success: boolean
  message: string
  fcm_available: boolean
  user_found: boolean
  tokens_count: number
  fcm_result?: IFcmMulticastResult
}

export class TestPushNotificationUseCase {
  constructor(public database: IDatabase) {}

  async handle(input: ITestPushNotificationInput): Promise<ITestPushNotificationOutput> {
    // Check if FCM is available
    const fcmAvailable = FcmService.isAvailable();

    if (!fcmAvailable) {
      return {
        success: false,
        message: 'FCM is not available. Firebase is not initialized.',
        fcm_available: false,
        user_found: false,
        tokens_count: 0,
      };
    }

    // Find user by username
    const trimmedUsername = input.username?.split(' ').join('').toLowerCase();

    const userResponse = await this.database.collection(usersCollectionName).retrieveAll({
      filter: {
        trimmed_username: {
          $regex: `^${trimmedUsername}$`,
          $options: 'i',
        },
      },
    });

    if (userResponse.data.length === 0) {
      return {
        success: false,
        message: `User with username "${input.username}" not found.`,
        fcm_available: true,
        user_found: false,
        tokens_count: 0,
      };
    }

    const user = userResponse.data[0] as unknown as IUserEntity;
    const fcmTokens: IFcmToken[] = user.fcm_tokens || [];

    if (fcmTokens.length === 0) {
      return {
        success: false,
        message: `User "${input.username}" has no registered FCM tokens.`,
        fcm_available: true,
        user_found: true,
        tokens_count: 0,
      };
    }

    // Extract token strings
    const tokens = fcmTokens.map((t) => t.token);

    // Send test push notification
    const fcmResult = await FcmService.sendToTokens({
      tokens,
      notification: {
        title: '🔔 Test Push Notification',
        body: `This is a test notification for user "${input.username}". If you see this, FCM is working correctly!`,
      },
      data: {
        type: 'test',
        username: input.username,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      success: fcmResult.successCount > 0,
      message:
        fcmResult.successCount > 0
          ? `Successfully sent test notification to ${fcmResult.successCount} device(s).`
          : `Failed to send notification. ${fcmResult.failureCount} device(s) failed.`,
      fcm_available: true,
      user_found: true,
      tokens_count: tokens.length,
      fcm_result: fcmResult,
    };
  }
}
