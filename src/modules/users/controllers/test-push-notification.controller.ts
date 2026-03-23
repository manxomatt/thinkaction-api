import type { IController, IControllerInput } from '@point-hub/papi';

import { schemaValidation } from '@/utils/validation';

import { RetrieveByUsernameRepository } from '../repositories/retrieve-by-username.repository';
import { testPushNotificationRules } from '../rules/test-push-notification.rules';
import { TestPushNotificationUseCase } from '../use-cases/test-push-notification.use-case';

export const testPushNotificationController: IController = async (controllerInput: IControllerInput) => {
  console.log('[TestPushNotificationController] Starting...');
  console.log('[TestPushNotificationController] Request body:', controllerInput.req['body']);

  // Validate request body against schema
  await schemaValidation(controllerInput.req['body'], testPushNotificationRules);
  console.log('[TestPushNotificationController] Validation passed');

  // Initialize repositories
  const retrieveByUsernameRepository = new RetrieveByUsernameRepository(controllerInput.dbConnection);

  // Initialize use case with dependencies
  const testPushNotificationUseCase = new TestPushNotificationUseCase({
    retrieveByUsernameRepository,
  });

  console.log('[TestPushNotificationController] Executing use case...');
  const startTime = Date.now();

  // Execute business logic
  const response = await testPushNotificationUseCase.handle({
    username: controllerInput.req['body'].username,
  });

  const endTime = Date.now();
  console.log(`[TestPushNotificationController] Use case completed in ${endTime - startTime}ms`);

  // Handle failed response
  if (response.status === 'failed') {
    controllerInput.res.status(response.error.code);
    controllerInput.res.statusMessage = response.error.message;
    controllerInput.res.json(response.error);
    return;
  }

  // Send success response
  controllerInput.res.status(200);
  controllerInput.res.json(response.data);
};
