import type { IController, IControllerInput } from '@point-hub/papi';

import { AblyService } from '@/modules/ably/services/ably.service';
import { CreateRepository as NotificationCreateRepository } from '@/modules/notifications/repositories/create.repository';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import type { IUserEntity } from '@/modules/users/interface';
import { RetrieveFcmTokensRepository } from '@/modules/users/repositories/retrieve-fcm-tokens.repository';
import { schemaValidation } from '@/utils/validation';

import { CreateRepository } from '../repositories/create.repository';
import { createRules } from '../rules/create.rules';
import { CreateUseCase } from '../use-cases/create.use-case';

export const createController: IController = async (controllerInput: IControllerInput) => {
  let session;
  try {
    // Start database session for transaction
    session = controllerInput.dbConnection.startSession();
    session.startTransaction();

    // Validate request body against schema
    await schemaValidation(controllerInput.req['body'], createRules);

    // Initialize repositories and utilities
    const createRepository = new CreateRepository(controllerInput.dbConnection, { session });
    const notificationCreateRepository = new NotificationCreateRepository(controllerInput.dbConnection, { session });
    const retrieveFcmTokensRepository = new RetrieveFcmTokensRepository(controllerInput.dbConnection, { session });
    const notificationService = new NotificationService({
      createRepository: notificationCreateRepository,
      retrieveFcmTokensRepository,
    });

    // Initialize use case with dependencies
    const createUseCase = new CreateUseCase({
      createRepository,
      notificationService,
      ablyService: AblyService,
    });

    // Execute business logic
    const response = await createUseCase.handle({
      user: controllerInput.req['user'] as IUserEntity,
      data: controllerInput.req['body'],
    });

    // Handle failed response
    if (response.status === 'failed') {
      controllerInput.res.status(response.error.code);
      controllerInput.res.statusMessage = response.error.message;
      controllerInput.res.json(response.error);
      return;
    }

    // Commit transaction and send response
    await session.commitTransaction();
    controllerInput.res.status(201);
    controllerInput.res.json(response.data);
  } catch (error) {
    await session?.abortTransaction();
    throw error;
  } finally {
    await session?.endSession();
  }
};
