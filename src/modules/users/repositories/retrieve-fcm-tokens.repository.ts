import type { IDatabase } from '@point-hub/papi';

import { collectionName } from '../entity';
import type { IFcmToken } from '../interface';

export interface IRetrieveFcmTokensRepository {
  handle(userId: string): Promise<IFcmToken[]>
  handleByUserIds(userIds: string[]): Promise<Map<string, IFcmToken[]>>
}

interface IUserWithFcmTokens {
  _id: string
  fcm_tokens?: IFcmToken[]
}

/**
 * Repository for retrieving FCM tokens
 */
export class RetrieveFcmTokensRepository implements IRetrieveFcmTokensRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  /**
   * Get FCM tokens for a single user
   */
  async handle(userId: string): Promise<IFcmToken[]> {
    const response = await this.database.collection(collectionName).retrieve(userId, this.options);

    if (!response) {
      return [];
    }

    const user = response as unknown as IUserWithFcmTokens;
    return user.fcm_tokens || [];
  }

  /**
   * Get FCM tokens for multiple users
   * Returns a Map with userId as key and array of FCM tokens as value
   */
  async handleByUserIds(userIds: string[]): Promise<Map<string, IFcmToken[]>> {
    const result = new Map<string, IFcmToken[]>();

    if (userIds.length === 0) {
      return result;
    }

    const response = await this.database.collection(collectionName).retrieveAll(
      {
        filter: {
          _id: { $in: userIds },
        },
      },
      this.options,
    );

    for (const userData of response.data) {
      const user = userData as unknown as IUserWithFcmTokens;
      const userId = user._id?.toString() || '';
      const tokens = user.fcm_tokens || [];
      result.set(userId, tokens);
    }

    return result;
  }
}
