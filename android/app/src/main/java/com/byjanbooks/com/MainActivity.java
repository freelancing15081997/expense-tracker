package com.byjanbooks.com;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShareReceiverPlugin.class);
        registerPlugin(UpiPayPlugin.class);
        registerPlugin(DocumentOcrPlugin.class);
        registerPlugin(AppLockPlugin.class);
        super.onCreate(savedInstanceState);
        ShareReceiverPlugin.ingestIntent(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        ShareReceiverPlugin.ingestIntent(this, intent);
    }
}
