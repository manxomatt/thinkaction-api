import type { IDatabase } from '@point-hub/papi';

import { runGoalReminderJob } from './goal-reminder';

/**
 * Cron Scheduler Configuration
 */
export interface ICronConfig {
  goalReminderHour: number // Hour in 24-hour format (0-23)
  goalReminderMinute: number // Minute (0-59)
  timezone: string // Timezone for scheduling
}

/**
 * Get cron configuration from environment variables
 */
export function getCronConfig(): ICronConfig {
  const hourStr = process.env['CRON_GOAL_REMINDER_HOUR'] || '8';
  const minuteStr = process.env['CRON_GOAL_REMINDER_MINUTE'] || '0';
  const timezone = process.env['CRON_TIMEZONE'] || 'Asia/Jakarta';

  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // Validate hour (0-23)
  if (isNaN(hour) || hour < 0 || hour > 23) {
    console.warn(`[Cron] Invalid CRON_GOAL_REMINDER_HOUR: ${hourStr}, using default 8`);
    return { goalReminderHour: 8, goalReminderMinute: 0, timezone };
  }

  // Validate minute (0-59)
  if (isNaN(minute) || minute < 0 || minute > 59) {
    console.warn(`[Cron] Invalid CRON_GOAL_REMINDER_MINUTE: ${minuteStr}, using default 0`);
    return { goalReminderHour: hour, goalReminderMinute: 0, timezone };
  }

  return { goalReminderHour: hour, goalReminderMinute: minute, timezone };
}

/**
 * Calculate milliseconds until next scheduled time
 */
function getMillisecondsUntilNextRun(targetHour: number, targetMinute: number): number {
  const now = new Date();
  const next = new Date(now);

  next.setHours(targetHour, targetMinute, 0, 0);

  // If the target time has already passed today, schedule for tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime() - now.getTime();
}

/**
 * Format time for logging
 */
function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Start the cron scheduler
 *
 * This scheduler runs jobs at specific times each day.
 * It uses setTimeout to schedule the next run, which is more accurate
 * than setInterval for daily jobs.
 */
export function startCronScheduler(dbConnection: IDatabase): void {
  const config = getCronConfig();

  console.log('[Cron] Starting cron scheduler');
  console.log(`[Cron] Goal reminder scheduled at ${formatTime(config.goalReminderHour, config.goalReminderMinute)} (${config.timezone})`);

  const scheduleNextRun = () => {
    const msUntilNextRun = getMillisecondsUntilNextRun(config.goalReminderHour, config.goalReminderMinute);
    const nextRunDate = new Date(Date.now() + msUntilNextRun);

    console.log(`[Cron] Next goal reminder scheduled for: ${nextRunDate.toISOString()}`);

    setTimeout(async () => {
      console.log(`[Cron] Running scheduled goal reminder job at ${new Date().toISOString()}`);

      try {
        await runGoalReminderJob(dbConnection);
      } catch (error) {
        console.error('[Cron] Error in goal reminder job:', error);
      }

      // Schedule the next run
      scheduleNextRun();
    }, msUntilNextRun);
  };

  // Start the scheduling
  scheduleNextRun();
}

/**
 * Run goal reminder job immediately (for testing or manual trigger)
 */
export async function runGoalReminderNow(dbConnection: IDatabase): Promise<void> {
  console.log('[Cron] Running goal reminder job immediately (manual trigger)');
  await runGoalReminderJob(dbConnection);
}
