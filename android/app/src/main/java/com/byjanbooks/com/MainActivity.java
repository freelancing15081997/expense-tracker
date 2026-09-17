package com.byjanbooks.com;

import android.app.NotificationManager;
import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareReceiverPlugin.class);
        registerPlugin(UpiPayPlugin.class);
        registerPlugin(DocumentOcrPlugin.class);
        registerPlugin(AppLockPlugin.class);
        registerPlugin(VoiceCapturePlugin.class);
        super.onCreate(savedInstanceState);
        WebView.setWebContentsDebuggingEnabled(true);
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        FirebaseMessagingService.ensureChannel(nm);
        ShareReceiverPlugin.ingestIntent(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ShareReceiverPlugin.ingestIntent(this, intent);
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        VoiceCapturePlugin.onOsPermissionResult(requestCode, grantResults);
    }
}
