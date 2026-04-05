import type { IController, IControllerInput } from '@point-hub/papi';

import { TestPushNotificationUseCase } from '../use-cases/test-push-notification.use-case';

export const testPushNotificationController: IController = async (controllerInput: IControllerInput) => {
  const useCase = new TestPushNotificationUseCase(controllerInput.dbConnection);
  const result = await useCase.handle(controllerInput.req.body);

  controllerInput.res.status(200).json(result);
};
