import type { IController, IMiddleware } from '@point-hub/papi';
import express, { type Express, type Request, type Response } from 'express';

import type { IBaseAppInput } from './app';
import ablyAuthRouter from './modules/ably/router';
import aiRouter from './modules/ai/router';
import cheerRouter from './modules/cheers/router';
import commentRouter from './modules/comments/router';
import fcmRouter from './modules/fcm/router';
import goalRouter from './modules/goals/router';
import healthRouter from './modules/health/router';
import notificationRouter from './modules/notifications/router';
import storageRouter from './modules/storages/router';
import supportRouter from './modules/supports/router';
import userRouter from './modules/users/router';
import authRouter from './modules/users/router-auth';
import { renderHbsTemplate } from './utils/email';

export interface IRoute {
  method: 'get' | 'post' | 'patch' | 'put' | 'delete'
  path: string
  controller: IController
  middlewares?: IMiddleware[]
}

export default async function (baseRouterInput: IBaseAppInput) {
  const app: Express = express();

  /**
   * Register all available modules
   * <modules>/router.ts
   */
  app.use('/v1/users', await userRouter(baseRouterInput));
  app.use('/v1/auth', await authRouter(baseRouterInput));
  app.use('/v1/ably', await ablyAuthRouter(baseRouterInput));
  app.use('/v1/health', await healthRouter(baseRouterInput));
  app.use('/v1/storages', await storageRouter(baseRouterInput));
  app.use('/v1/goals', await goalRouter(baseRouterInput));
  app.use('/v1/cheers', await cheerRouter(baseRouterInput));
  app.use('/v1/comments', await commentRouter(baseRouterInput));
  app.use('/v1/supports', await supportRouter(baseRouterInput));
  app.use('/v1/notifications', await notificationRouter(baseRouterInput));
  app.use('/v1/ai', await aiRouter(baseRouterInput));
  app.use('/v1/fcm', await fcmRouter(baseRouterInput));

  /**
   * Rendered email templates
   *
   * @example
   * Access this in your browser using the following path:
   * /templates/modules/examples/emails/example
   */
  app.get('/templates/*param', async (req: Request, res: Response) => {
    const params = Array.isArray(req.params['param']) ? req.params['param'].join('/') : req.params['param'];
    const html = await renderHbsTemplate(`${params}.hbs`);
    res.send(html);
  });

  return app;
}
