import type { IDatabase } from '@point-hub/papi';

import { runGoalReminderJob } from './goal-reminder';

/**
 * Cron Scheduler Configuration
 */
export interface ICronConfig {
  goalReminderMinute: number // Minute of each hour to run (0-59)
  timezone: string // Timezone for scheduling
}

/**
 * Get cron configuration from environment variables
 */
export function getCronConfig(): ICronConfig {
  const minuteStr = process.env['CRON_GOAL_REMINDER_MINUTE'] || '0';
  const timezone = process.env['CRON_TIMEZONE'] || 'Asia/Jakarta';

  const minute = parseInt(minuteStr, 10);

  // Validate minute (0-59)
  if (isNaN(minute) || minute < 0 || minute > 59) {
    console.warn(`[Cron] Invalid CRON_GOAL_REMINDER_MINUTE: ${minuteStr}, using default 0`);
    return { goalReminderMinute: 0, timezone };
  }

  return { goalReminderMinute: minute, timezone };
}

/**
 * Calculate milliseconds until next hourly run
 * The job runs every hour at the specified minute
 */
function getMillisecondsUntilNextHourlyRun(targetMinute: number): number {
  const now = new Date();
  const next = new Date(now);

  next.setMinutes(targetMinute, 0, 0);

  // If the target minute has already passed this hour, schedule for next hour
  if (next <= now) {
    next.setHours(next.getHours() + 1);
  }

  return next.getTime() - now.getTime();
}

/**
 * Start the cron scheduler
 *
 * This scheduler runs the goal reminder job every hour at the specified minute.
 * It uses setTimeout to schedule the next run, which is more accurate
 * than setInterval for hourly jobs.
 *
 * Example: If CRON_GOAL_REMINDER_MINUTE=0, the job runs at:
 * - 00:00, 01:00, 02:00, ..., 23:00 every day
 *
 * Each run checks for goals with deadline in the same hour tomorrow.
 */
export function startCronScheduler(dbConnection: IDatabase): void {
  const config = getCronConfig();

  console.log('[Cron] Starting cron scheduler');
  console.log(`[Cron] Goal reminder scheduled to run every hour at minute :${config.goalReminderMinute.toString().padStart(2, '0')} (${config.timezone})`);

  const scheduleNextRun = () => {
    const msUntilNextRun = getMillisecondsUntilNextHourlyRun(config.goalReminderMinute);
    const nextRunDate = new Date(Date.now() + msUntilNextRun);

    console.log(`[Cron] Next goal reminder scheduled for: ${nextRunDate.toISOString()}`);

    setTimeout(async () => {
      console.log(`[Cron] Running scheduled goal reminder job at ${new Date().toISOString()}`);

      try {
        await runGoalReminderJob(dbConnection);
      } catch (error) {
        console.error('[Cron] Error in goal reminder job:', error);
      }

      // Schedule the next run (next hour)
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
