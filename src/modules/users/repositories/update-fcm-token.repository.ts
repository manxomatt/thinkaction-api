import type { IDatabase } from '@point-hub/papi';

import { collectionName } from '../entity';

export interface IUpdateFcmTokenRepository {
  handle(_id: string, fcmToken: string): Promise<IUpdateFcmTokenOutput>
}

export interface IUpdateFcmTokenOutput {
  matched_count: number
  modified_count: number
}

export class UpdateFcmTokenRepository implements IUpdateFcmTokenRepository {
  constructor(
    public database: IDatabase,
    public options?: Record<string, unknown>,
  ) { }

  async handle(_id: string, fcmToken: string): Promise<IUpdateFcmTokenOutput> {
    return await this.database
      .collection(collectionName)
      .update(_id, { fcm_token: fcmToken, updated_at: new Date() }, this.options);
  }
}
