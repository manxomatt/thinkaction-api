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
 * This job checks for goals with target date (time field) that is H-1 (1 day before deadline)
 * and sends FCM push notifications to remind users.
 */
export async function runGoalReminderJob(dbConnection: IDatabase): Promise<void> {
  console.log('[Goal Reminder] Starting goal reminder job...');

  const now = new Date();

  // Calculate tomorrow's date range (H-1 means target is tomorrow)
  const tomorrowStart = new Date(now);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  tomorrowStart.setHours(0, 0, 0, 0);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setHours(23, 59, 59, 999);

  console.log(`[Goal Reminder] Checking goals with deadline between ${tomorrowStart.toISOString()} and ${tomorrowEnd.toISOString()}`);

  try {
    // Find goals with target date (time field) that is tomorrow and status is in-progress
    const goalsResponse = await dbConnection.collection('goals').retrieveAll({
      filter: {
        time: {
          $gte: tomorrowStart,
          $lte: tomorrowEnd,
        },
        status: 'in-progress',
      },
    });

    const goals = goalsResponse.data as IGoalEntity[];
    console.log(`[Goal Reminder] Found ${goals.length} goals with deadline tomorrow`);

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
