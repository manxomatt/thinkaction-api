import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IFcmToken } from '../interface';
import type { IUpdateFcmTokenRepository } from '../repositories/update-fcm-token.repository';

export interface IInput {
  user_id: string
  data: {
    token: string
    device_id?: string
    device_type?: 'ios' | 'android' | 'web'
  }
}

export interface IDeps {
  updateFcmTokenRepository: IUpdateFcmTokenRepository
}

export interface ISuccessData {
  matched_count: number
  modified_count: number
}

/**
 * Use case: Register or update FCM token for push notifications.
 *
 * Responsibilities:
 * 1. Validate the FCM token data.
 * 2. Update or add the FCM token for the user.
 * 3. Return success response.
 */
export class RegisterFcmTokenUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // 1. Build FCM token object
    const fcmToken: IFcmToken = {
      token: input.data.token,
      device_id: input.data.device_id,
      device_type: input.data.device_type,
    };

    // 2. Update or add the FCM token for the user
    const response = await this.deps.updateFcmTokenRepository.handle(input.user_id, fcmToken);

    // 3. Return success response
    return this.success({
      matched_count: response.matched_count,
      modified_count: response.modified_count,
    });
  }
}
