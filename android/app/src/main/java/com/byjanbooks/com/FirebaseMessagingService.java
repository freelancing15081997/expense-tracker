package com.byjanbooks.com;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class FirebaseMessagingService extends com.capacitorjs.plugins.pushnotifications.MessagingService {
    private static final String TAG = "FCMService";
    static final String CHANNEL_ID = "byjan_alerts";

    static void ensureChannel(NotificationManager notificationManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || notificationManager == null) return;
        NotificationChannel existing = notificationManager.getNotificationChannel(CHANNEL_ID);
        if (existing != null && existing.getImportance() >= NotificationManager.IMPORTANCE_HIGH) {
            return;
        }
        Uri sound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Byjan Notifications",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("When a teammate adds or changes an entry");
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0, 180, 80, 180 });
        channel.setShowBadge(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        AudioAttributes audio = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(sound, audio);
        notificationManager.createNotificationChannel(channel);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        Map<String, String> data = remoteMessage.getData();
        if (data != null && !data.isEmpty()) {
            Log.d(TAG, "Message data payload: " + data);
        }

        String title = null;
        String body = null;
        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }
        if (title == null && data != null) title = data.get("title");
        if (body == null && data != null) body = data.get("body");
        if (body == null) body = "New update in a money book";
        sendNotification(title, body, data);
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "Refreshed token: " + token);
        sendRegistrationToServer(token);
    }

    private void sendRegistrationToServer(String token) {
        Log.d(TAG, "Token sent to server: " + token);
    }

    private void sendNotification(String title, String messageBody, Map<String, String> data) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                if (entry.getKey() != null && entry.getValue() != null) {
                    intent.putExtra(entry.getKey(), entry.getValue());
                }
            }
        }

        int requestCode = (int) (System.currentTimeMillis() & 0x7fffffff);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_byjan)
            .setLargeIcon(byjanLargeIcon())
            .setColor(0xFFF97316)
            .setContentTitle(title != null ? title : "Byjan")
            .setContentText(messageBody)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(messageBody))
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setVibrate(new long[] { 0, 180, 80, 180 })
            .setDefaults(NotificationCompat.DEFAULT_SOUND | NotificationCompat.DEFAULT_VIBRATE)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        NotificationManager notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        ensureChannel(notificationManager);
        notificationManager.notify(requestCode, notificationBuilder.build());
    }

    private Bitmap byjanLargeIcon() {
        try {
            Bitmap launcher = BitmapFactory.decodeResource(getResources(), R.mipmap.ic_launcher);
            if (launcher != null) {
                return Bitmap.createScaledBitmap(launcher, 192, 192, true);
            }
        } catch (Exception ignored) {}
        int notifyId = getResources().getIdentifier("ic_byjan_notify", "drawable", getPackageName());
        if (notifyId != 0) {
            Bitmap png = BitmapFactory.decodeResource(getResources(), notifyId);
            if (png != null) return Bitmap.createScaledBitmap(png, 192, 192, true);
        }
        Drawable d = ContextCompat.getDrawable(this, R.drawable.ic_byjan_color);
        if (d == null) return null;
        Bitmap bitmap = Bitmap.createBitmap(192, 192, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        d.setBounds(0, 0, 192, 192);
        d.draw(canvas);
        return bitmap;
    }
}
