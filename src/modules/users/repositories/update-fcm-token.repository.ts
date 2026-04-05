import type { IDatabase } from '@point-hub/papi';

import { collectionName } from '../entity';
import type { IFcmToken } from '../interface';

export interface IUpdateFcmTokenRepository {
  handle(userId: string, fcmToken: IFcmToken): Promise<IUpdateFcmTokenOutput>
  remove(userId: string, deviceId: string): Promise<IUpdateFcmTokenOutput>
}

export interface IUpdateFcmTokenOutput {
  matched_count: number
  modified_count: number
}

/**
 * Repository for updating FCM tokens
 * Uses upsert logic: if token exists for device, update it; otherwise, add new token
 */
export class UpdateFcmTokenRepository implements IUpdateFcmTokenRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(userId: string, fcmToken: IFcmToken): Promise<IUpdateFcmTokenOutput> {
    const collection = this.database.collection(collectionName);

    // First, try to update existing token for the same device_id using positional operator
    if (fcmToken.device_id) {
      // Try to find and update existing token with same device_id
      const existingUser = await collection.retrieve(userId, this.options);

      if (existingUser) {
        const existingTokens = (existingUser as unknown as { fcm_tokens?: IFcmToken[] }).fcm_tokens || [];
        const existingTokenIndex = existingTokens.findIndex(t => t.device_id === fcmToken.device_id);

        if (existingTokenIndex !== -1) {
          // Update existing token
          existingTokens[existingTokenIndex] = {
            ...existingTokens[existingTokenIndex],
            token: fcmToken.token,
            device_type: fcmToken.device_type,
            updated_at: new Date(),
          };

          const updateResult = await collection.update(userId, {
            fcm_tokens: existingTokens,
          }, this.options);

          return {
            matched_count: updateResult.matched_count,
            modified_count: updateResult.modified_count,
          };
        }
      }
    }

    // If no existing token found for device, add new token to the array
    const existingUser = await collection.retrieve(userId, this.options);
    const existingTokens = existingUser
      ? ((existingUser as unknown as { fcm_tokens?: IFcmToken[] }).fcm_tokens || [])
      : [];

    const newToken: IFcmToken = {
      token: fcmToken.token,
      device_id: fcmToken.device_id,
      device_type: fcmToken.device_type,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const updatedTokens = [...existingTokens, newToken];

    const pushResult = await collection.update(userId, {
      fcm_tokens: updatedTokens,
    }, this.options);

    return {
      matched_count: pushResult.matched_count,
      modified_count: pushResult.modified_count,
    };
  }

  /**
   * Remove FCM token by device_id
   */
  async remove(userId: string, deviceId: string): Promise<IUpdateFcmTokenOutput> {
    const collection = this.database.collection(collectionName);

    // Get existing tokens
    const existingUser = await collection.retrieve(userId, this.options);

    if (!existingUser) {
      return {
        matched_count: 0,
        modified_count: 0,
      };
    }

    const existingTokens = (existingUser as unknown as { fcm_tokens?: IFcmToken[] }).fcm_tokens || [];
    const filteredTokens = existingTokens.filter(t => t.device_id !== deviceId);

    // Only update if we actually removed something
    if (filteredTokens.length === existingTokens.length) {
      return {
        matched_count: 1,
        modified_count: 0,
      };
    }

    const result = await collection.update(userId, {
      fcm_tokens: filteredTokens,
    }, this.options);

    return {
      matched_count: result.matched_count,
      modified_count: result.modified_count,
    };
  }
}
