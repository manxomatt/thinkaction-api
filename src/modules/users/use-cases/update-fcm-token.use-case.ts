import { BaseUseCase, type IUseCaseOutputFailed, type IUseCaseOutputSuccess } from '@point-hub/papi';

import type { IUpdateFcmTokenRepository } from '../repositories/update-fcm-token.repository';

export interface IInput {
  filter: {
    _id?: string
  }
  data: {
    fcm_token: string
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
 * Use case: Update user FCM token for push notifications.
 *
 * Responsibilities:
 * 1. Update the user's FCM token in the repository.
 * 2. Return standardized success response.
 */
export class UpdateFcmTokenUseCase extends BaseUseCase<IInput, IDeps, ISuccessData> {
  async handle(input: IInput): Promise<IUseCaseOutputSuccess<ISuccessData> | IUseCaseOutputFailed> {
    // 1. Update the user's FCM token in the repository.
    const response = await this.deps.updateFcmTokenRepository.handle(
      input.filter._id as string,
      input.data.fcm_token,
    );

    // 2. Return standardized success response.
    return this.success({
      matched_count: response.matched_count,
      modified_count: response.modified_count,
    });
  }
}
