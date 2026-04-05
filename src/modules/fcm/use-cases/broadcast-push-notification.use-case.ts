import type { IDatabase } from '@point-hub/papi';

import { collectionName as usersCollectionName } from '@/modules/users/entity';
import type { IFcmToken, IUserEntity } from '@/modules/users/interface';

import { FcmService, type IFcmMulticastResult } from '../services/fcm.service';

export interface IBroadcastPushNotificationInput {
  title: string
  body: string
  image_url?: string
  user_ids?: string[]
  data?: Record<string, string>
}

export interface IBroadcastPushNotificationOutput {
  success: boolean
  message: string
  fcm_available: boolean
  total_users: number
  total_tokens: number
  fcm_result?: IFcmMulticastResult
}

export class BroadcastPushNotificationUseCase {
  constructor(public database: IDatabase) {}

  async handle(input: IBroadcastPushNotificationInput): Promise<IBroadcastPushNotificationOutput> {
    // Check if FCM is available
    const fcmAvailable = FcmService.isAvailable();

    if (!fcmAvailable) {
      return {
        success: false,
        message: 'FCM is not available. Firebase is not initialized.',
        fcm_available: false,
        total_users: 0,
        total_tokens: 0,
      };
    }

    // Build query filter
    const filter: Record<string, unknown> = {
      fcm_tokens: { $exists: true, $ne: [] },
    };

    // If user_ids provided, filter by those users only
    if (input.user_ids && input.user_ids.length > 0) {
      filter['_id'] = { $in: input.user_ids };
    }

    // Retrieve users with FCM tokens
    const usersResponse = await this.database.collection(usersCollectionName).retrieveAll({
      filter,
      projection: {
        _id: 1,
        fcm_tokens: 1,
      },
    });

    const users = usersResponse.data as unknown as IUserEntity[];

    if (users.length === 0) {
      return {
        success: false,
        message: input.user_ids && input.user_ids.length > 0
          ? 'No users found with the specified IDs that have registered FCM tokens.'
          : 'No users found with registered FCM tokens.',
        fcm_available: true,
        total_users: 0,
        total_tokens: 0,
      };
    }

    // Collect all FCM tokens from users
    const allTokens: string[] = [];
    for (const user of users) {
      const fcmTokens: IFcmToken[] = user.fcm_tokens || [];
      for (const tokenObj of fcmTokens) {
        if (tokenObj.token) {
          allTokens.push(tokenObj.token);
        }
      }
    }

    if (allTokens.length === 0) {
      return {
        success: false,
        message: 'No valid FCM tokens found for the target users.',
        fcm_available: true,
        total_users: users.length,
        total_tokens: 0,
      };
    }

    // FCM has a limit of 500 tokens per multicast request
    // We need to batch the tokens if there are more than 500
    const BATCH_SIZE = 500;
    let totalSuccessCount = 0;
    let totalFailureCount = 0;
    const allResponses: IFcmMulticastResult['responses'] = [];

    for (let i = 0; i < allTokens.length; i += BATCH_SIZE) {
      const batchTokens = allTokens.slice(i, i + BATCH_SIZE);

      const fcmResult = await FcmService.sendToTokens({
        tokens: batchTokens,
        notification: {
          title: input.title,
          body: input.body,
          imageUrl: input.image_url,
        },
        data: input.data,
      });

      totalSuccessCount += fcmResult.successCount;
      totalFailureCount += fcmResult.failureCount;
      allResponses.push(...fcmResult.responses);
    }

    const aggregatedResult: IFcmMulticastResult = {
      successCount: totalSuccessCount,
      failureCount: totalFailureCount,
      responses: allResponses,
    };

    return {
      success: totalSuccessCount > 0,
      message: totalSuccessCount > 0
        ? `Successfully sent broadcast notification to ${totalSuccessCount} device(s) across ${users.length} user(s).`
        : `Failed to send broadcast notification. ${totalFailureCount} device(s) failed.`,
      fcm_available: true,
      total_users: users.length,
      total_tokens: allTokens.length,
      fcm_result: aggregatedResult,
    };
  }
}
