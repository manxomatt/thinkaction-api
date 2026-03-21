import type { IController, IControllerInput } from '@point-hub/papi';

import { schemaValidation } from '@/utils/validation';

import { UpdateFcmTokenRepository } from '../repositories/update-fcm-token.repository';
import { updateFcmTokenRules } from '../rules/update-fcm-token.rules';
import { UpdateFcmTokenUseCase } from '../use-cases/update-fcm-token.use-case';

export const updateFcmTokenController: IController = async (controllerInput: IControllerInput) => {
  let session;
  try {
    // Start database session for transaction
    session = controllerInput.dbConnection.startSession();
    session.startTransaction();

    // Validate request body against schema
    await schemaValidation(controllerInput.req['body'], updateFcmTokenRules);

    // Initialize repositories
    const updateFcmTokenRepository = new UpdateFcmTokenRepository(controllerInput.dbConnection, { session });

    // Initialize use case with dependencies
    const updateFcmTokenUseCase = new UpdateFcmTokenUseCase({
      updateFcmTokenRepository,
    });

    // Execute business logic
    const response = await updateFcmTokenUseCase.handle({
      filter: {
        _id: controllerInput.req['user']?._id,
      },
      data: {
        fcm_token: controllerInput.req['body'].fcm_token,
      },
    });

    console.log('Use case response:', response);

    // Handle failed response
    if (response.status === 'failed') {
      controllerInput.res.status(response.error.code);
      controllerInput.res.statusMessage = response.error.message;
      controllerInput.res.json(response.error);
      return;
    }

    // Commit transaction and send response
    await session.commitTransaction();
    controllerInput.res.status(200);
    controllerInput.res.json(response.data);
  } catch (error) {
    await session?.abortTransaction();
    throw error;
  } finally {
    await session?.endSession();
  }
};
