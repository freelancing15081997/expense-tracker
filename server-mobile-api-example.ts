/**
 * Mobile API Endpoints Example
 * 
 * Add these endpoints to your Express server to support mobile features.
 * This file is a reference implementation - integrate it into your server.ts
 */

import { Request, Response } from 'express';
// You'll need to install firebase-admin: npm install firebase-admin
// import admin from 'firebase-admin';

// Initialize Firebase Admin (do this once in your server)
/*
const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
*/

/**
 * Store push tokens in your database
 * This endpoint receives push tokens from mobile devices
 */
export async function registerPushToken(req: Request, res: Response) {
  try {
    const { token, platform, userId } = req.body;

    if (!token || !platform) {
      return res.status(400).json({ error: 'Token and platform are required' });
    }

    // TODO: Store the token in your database
    // Example structure:
    // {
    //   userId: string,
    //   token: string,
    //   platform: 'android' | 'ios',
    //   createdAt: Date,
    //   lastUsed: Date,
    // }

    console.log('Push token registered:', {
      userId,
      token: token.substring(0, 20) + '...',
      platform,
    });

    // Save to database
    // await db.pushTokens.upsert({
    //   where: { userId_token: { userId, token } },
    //   create: { userId, token, platform, createdAt: new Date() },
    //   update: { lastUsed: new Date() },
    // });

    res.json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({ error: 'Failed to register push token' });
  }
}

/**
 * Send push notifications to devices
 * This endpoint sends notifications using Firebase Cloud Messaging
 */
export async function sendPushNotification(req: Request, res: Response) {
  try {
    const { tokens, title, body, data } = req.body;

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ error: 'Tokens array is required' });
    }

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    // Send notification using Firebase Admin SDK
    /*
    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens,
    };

    const response = await admin.messaging().sendMulticast(message);

    console.log('Push notifications sent:', {
      successCount: response.successCount,
      failureCount: response.failureCount,
    });

    // Handle failed tokens (remove invalid ones from database)
    if (response.failureCount > 0) {
      const failedTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      
      // Remove invalid tokens from database
      // await db.pushTokens.deleteMany({
      //   where: { token: { in: failedTokens } },
      // });
    }

    res.json({
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    });
    */

    // Placeholder response (remove when implementing Firebase Admin)
    res.json({
      success: true,
      message: 'Notification sending not yet configured',
      note: 'Install firebase-admin and configure the service account',
    });
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).json({ error: 'Failed to send push notification' });
  }
}

/**
 * Send notification to a specific user
 */
export async function sendNotificationToUser(req: Request, res: Response) {
  try {
    const { userId, title, body, data } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({ error: 'userId, title, and body are required' });
    }

    // Get user's tokens from database
    // const tokens = await db.pushTokens.findMany({
    //   where: { userId },
    //   select: { token: true },
    // });

    // if (tokens.length === 0) {
    //   return res.status(404).json({ error: 'No push tokens found for user' });
    // }

    // const tokenStrings = tokens.map(t => t.token);

    // Send notification
    /*
    const message = {
      notification: { title, body },
      data: data || {},
      tokens: tokenStrings,
    };

    const response = await admin.messaging().sendMulticast(message);
    */

    res.json({
      success: true,
      message: 'Notification sent to user',
      // successCount: response.successCount,
    });
  } catch (error) {
    console.error('Error sending notification to user:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
}

/**
 * Send notification to all users
 */
export async function sendNotificationToAll(req: Request, res: Response) {
  try {
    const { title, body, data } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required' });
    }

    // Get all tokens from database
    // const tokens = await db.pushTokens.findMany({
    //   select: { token: true },
    // });

    // if (tokens.length === 0) {
    //   return res.status(404).json({ error: 'No push tokens found' });
    // }

    // const tokenStrings = tokens.map(t => t.token);

    // Firebase has a limit of 500 tokens per request
    // Split into batches if needed
    /*
    const batchSize = 500;
    const batches = [];
    
    for (let i = 0; i < tokenStrings.length; i += batchSize) {
      batches.push(tokenStrings.slice(i, i + batchSize));
    }

    let totalSuccess = 0;
    let totalFailure = 0;

    for (const batch of batches) {
      const message = {
        notification: { title, body },
        data: data || {},
        tokens: batch,
      };

      const response = await admin.messaging().sendMulticast(message);
      totalSuccess += response.successCount;
      totalFailure += response.failureCount;
    }
    */

    res.json({
      success: true,
      message: 'Broadcast notification sent',
      // successCount: totalSuccess,
      // failureCount: totalFailure,
    });
  } catch (error) {
    console.error('Error sending broadcast notification:', error);
    res.status(500).json({ error: 'Failed to send broadcast notification' });
  }
}

/**
 * Example: Send expense notification
 */
export async function sendExpenseNotification(
  userId: string,
  expense: { id: string; amount: number; category: string }
) {
  try {
    // Get user tokens
    // const tokens = await db.pushTokens.findMany({
    //   where: { userId },
    //   select: { token: true },
    // });

    // if (tokens.length === 0) return;

    /*
    const message = {
      notification: {
        title: 'New Expense Added',
        body: `${expense.category}: $${expense.amount}`,
      },
      data: {
        type: 'expense',
        expenseId: expense.id,
        url: `/expenses/${expense.id}`,
      },
      tokens: tokens.map(t => t.token),
    };

    await admin.messaging().sendMulticast(message);
    */
    
    console.log('Expense notification sent:', { userId, expense });
  } catch (error) {
    console.error('Error sending expense notification:', error);
  }
}

/**
 * Example: Send budget alert notification
 */
export async function sendBudgetAlert(
  userId: string,
  alert: { category: string; spent: number; budget: number }
) {
  try {
    const percentage = Math.round((alert.spent / alert.budget) * 100);

    /*
    const tokens = await db.pushTokens.findMany({
      where: { userId },
      select: { token: true },
    });

    if (tokens.length === 0) return;

    const message = {
      notification: {
        title: 'Budget Alert',
        body: `You've used ${percentage}% of your ${alert.category} budget`,
      },
      data: {
        type: 'budget_alert',
        category: alert.category,
        url: '/budgets',
      },
      tokens: tokens.map(t => t.token),
    };

    await admin.messaging().sendMulticast(message);
    */
    
    console.log('Budget alert sent:', { userId, percentage });
  } catch (error) {
    console.error('Error sending budget alert:', error);
  }
}

/**
 * Add these routes to your Express app:
 * 
 * app.post('/api/push-token', registerPushToken);
 * app.post('/api/push-notifications', sendPushNotification);
 * app.post('/api/push-notifications/user', sendNotificationToUser);
 * app.post('/api/push-notifications/broadcast', sendNotificationToAll);
 */

/**
 * Database Schema Example (Prisma)
 * 
 * model PushToken {
 *   id        String   @id @default(cuid())
 *   userId    String
 *   token     String
 *   platform  String   // 'android' | 'ios'
 *   createdAt DateTime @default(now())
 *   lastUsed  DateTime @default(now())
 *   
 *   user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
 *   
 *   @@unique([userId, token])
 *   @@index([userId])
 * }
 */

/**
 * Firebase Admin Setup
 * 
 * 1. Go to Firebase Console > Project Settings > Service Accounts
 * 2. Click "Generate New Private Key"
 * 3. Save the JSON file securely (DO NOT commit to git)
 * 4. Initialize Firebase Admin with the service account
 * 
 * const serviceAccount = require('./firebase-service-account.json');
 * 
 * admin.initializeApp({
 *   credential: admin.credential.cert(serviceAccount),
 * });
 */
