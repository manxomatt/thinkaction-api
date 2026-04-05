import { createApp } from './app';
import { initializeFirebase } from './config/firebase';
import serverConfig from './config/server';
import { startCronScheduler } from './cron';
import { dbConnection } from './database/database';
import { createServer } from './server';

/**
 * Create database connection. It will keep the connection open by default,
 * and use the same connection for all queries. If you need to close the connection,
 * call dbConnection.close() (which is asynchronous and returns a Promise)..
 */
await dbConnection.open();

/**
 * Initialize Firebase Admin SDK for FCM push notifications
 */
initializeFirebase();

/**
 * Start cron scheduler for background jobs
 * - Goal reminder: Sends FCM notifications for goals with H-1 deadline
 */
startCronScheduler(dbConnection);

/**
 * Create HTTP Server for API
 */
const app = await createApp({ dbConnection });
createServer(app, serverConfig);
