import type { IDatabase } from '@point-hub/papi';

import { FcmService } from '@/modules/fcm/services/fcm.service';
import type { IGoalEntity } from '@/modules/goals/interface';
import type { IFcmToken } from '@/modules/users/interface';

interface IUserWithFcmTokens {
  _id: string
  fcm_tokens?: IFcmToken[]
}

/**
 * Goal Reminder Cron Job
 *
 * This job runs every hour and checks for goals with target date (time field)
 * that falls within the same hour tomorrow.
 *
 * Example: If the cron runs at 9:00 AM today, it will send notifications for
 * goals with deadline between 9:00 AM - 9:59 AM tomorrow.
 */
export async function runGoalReminderJob(dbConnection: IDatabase): Promise<void> {
  console.log('[Goal Reminder] Starting goal reminder job...');

  const now = new Date();
  const currentHour = now.getHours();

  // Calculate tomorrow's hour range
  // If cron runs at 9:00 AM today, check for goals with deadline 9:00 AM - 9:59 AM tomorrow
  const tomorrowHourStart = new Date(now);
  tomorrowHourStart.setDate(tomorrowHourStart.getDate() + 1);
  tomorrowHourStart.setHours(currentHour, 0, 0, 0);

  const tomorrowHourEnd = new Date(tomorrowHourStart);
  tomorrowHourEnd.setMinutes(59, 59, 999);

  console.log(`[Goal Reminder] Current hour: ${currentHour}:00`);
  console.log(`[Goal Reminder] Checking goals with deadline between ${tomorrowHourStart.toISOString()} and ${tomorrowHourEnd.toISOString()}`);

  try {
    // Find goals with target date (time field) that falls within the same hour tomorrow and status is in-progress
    const goalsResponse = await dbConnection.collection('goals').retrieveAll({
      filter: {
        time: {
          $gte: tomorrowHourStart,
          $lte: tomorrowHourEnd,
        },
        status: 'in-progress',
      },
    });

    const goals = goalsResponse.data as IGoalEntity[];
    console.log(`[Goal Reminder] Found ${goals.length} goals with deadline tomorrow at ${currentHour}:00-${currentHour}:59`);

    if (goals.length === 0) {
      console.log('[Goal Reminder] No goals to remind. Job completed.');
      return;
    }

    // Get unique user IDs from goals
    const userIds = [...new Set(goals.map((goal) => goal.created_by_id).filter(Boolean))] as string[];

    // Fetch FCM tokens for all users
    const usersResponse = await dbConnection.collection('users').retrieveAll({
      filter: {
        _id: { $in: userIds },
      },
    });

    const usersMap = new Map<string, IFcmToken[]>();
    for (const userData of usersResponse.data) {
      const user = userData as unknown as IUserWithFcmTokens;
      const userId = user._id?.toString() || '';
      const tokens = user.fcm_tokens || [];
      usersMap.set(userId, tokens);
    }

    // Process each goal and send notifications
    for (const goal of goals) {
      const userId = goal.created_by_id;
      if (!userId) {
        continue;
      }

      const fcmTokens = usersMap.get(userId) || [];
      const tokens = fcmTokens.map((t) => t.token).filter(Boolean);

      // Create notification record in database
      const notificationData = {
        type: 'goal-reminder',
        actor_id: null,
        recipient_id: userId,
        message: `Reminder: Your goal "${goal.specific || goal.smart || 'Untitled Goal'}" has only 1 day left!`,
        is_read: false,
        entities: {
          goals: goal._id,
        },
        created_at: new Date(),
      };

      await dbConnection.collection('notifications').create(notificationData);
      console.log(`[Goal Reminder] Created notification for user ${userId}, goal ${goal._id}`);

      // Send FCM push notification if user has tokens
      if (tokens.length > 0 && FcmService.isAvailable()) {
        const fcmResult = await FcmService.sendToTokens({
          tokens,
          notification: {
            title: '⏰ Goal Deadline Reminder',
            body: `Your goal "${goal.specific || goal.smart || 'Untitled Goal'}" has only 1 day left! Keep pushing!`,
          },
          data: {
            type: 'goal-reminder',
            goal_id: goal._id?.toString() || '',
          },
        });

        console.log(`[Goal Reminder] FCM sent to user ${userId}: ${fcmResult.successCount} success, ${fcmResult.failureCount} failure`);
      } else if (tokens.length === 0) {
        console.log(`[Goal Reminder] User ${userId} has no FCM tokens registered`);
      }
    }

    console.log('[Goal Reminder] Job completed successfully');
  } catch (error) {
    console.error('[Goal Reminder] Error running goal reminder job:', error);
    throw error;
  }
}
