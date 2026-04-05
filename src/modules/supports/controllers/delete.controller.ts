import type { IController, IControllerInput } from '@point-hub/papi';

import { AblyService } from '@/modules/ably/services/ably.service';
import { CreateRepository as NotificationCreateRepository } from '@/modules/notifications/repositories/create.repository';
import { NotificationService } from '@/modules/notifications/services/notification.service';
import { StorageService } from '@/modules/storages/utils/storage-service';
import type { IUserEntity } from '@/modules/users/interface';
import { RetrieveFcmTokensRepository } from '@/modules/users/repositories/retrieve-fcm-tokens.repository';

import { DeleteRepository } from '../repositories/delete.repository';
import { RetrieveRepository } from '../repositories/retrieve.repository';
import { DeleteUseCase } from '../use-cases/delete.use-case';

export const deleteController: IController = async (controllerInput: IControllerInput) => {
  let session;
  try {
    // Start database session for transaction
    session = controllerInput.dbConnection.startSession();
    session.startTransaction();

    // Initialize repositories and utilities
    const deleteRepository = new DeleteRepository(controllerInput.dbConnection, { session });
    const retrieveRepository = new RetrieveRepository(controllerInput.dbConnection, { session });
    const notificationCreateRepository = new NotificationCreateRepository(controllerInput.dbConnection, { session });
    const retrieveFcmTokensRepository = new RetrieveFcmTokensRepository(controllerInput.dbConnection, { session });
    const notificationService = new NotificationService({
      createRepository: notificationCreateRepository,
      retrieveFcmTokensRepository,
    });

    // Initialize use case with dependencies
    const deleteUseCase = new DeleteUseCase({
      deleteRepository,
      retrieveRepository,
      notificationService,
      storageService: StorageService,
      ablyService: AblyService,
    });

    // Execute business logic
    const response = await deleteUseCase.handle({
      _id: controllerInput.req['params']['id'],
      user: controllerInput.req['user'] as IUserEntity,
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
    controllerInput.res.status(200);
    controllerInput.res.json(response.data);
  } catch (error) {
    await session?.abortTransaction();
    throw error;
  } finally {
    await session?.endSession();
  }
};
