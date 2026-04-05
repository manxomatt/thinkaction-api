import type { IController, IControllerInput } from '@point-hub/papi';

import { schemaValidation } from '@/utils/validation';

import { broadcastPushNotificationRules } from '../rules/broadcast-push-notification.rules';
import { BroadcastPushNotificationUseCase } from '../use-cases/broadcast-push-notification.use-case';

export const broadcastPushNotificationController: IController = async (controllerInput: IControllerInput) => {
  // Validate request body against schema
  await schemaValidation(controllerInput.req['body'], broadcastPushNotificationRules);

  const useCase = new BroadcastPushNotificationUseCase(controllerInput.dbConnection);
  const result = await useCase.handle(controllerInput.req.body);

  controllerInput.res.status(200).json(result);
};
