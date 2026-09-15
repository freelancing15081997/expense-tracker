package com.byjanbooks.com;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Receives Android ACTION_SEND shares (images / text) into the Capacitor bridge.
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {
    private static final int MAX_BYTES = 6 * 1024 * 1024;
    private static JSObject pending;
    private static ShareReceiverPlugin instance;

    @Override
    public void load() {
        instance = this;
        Activity activity = getActivity();
        if (activity != null) {
            ingestIntent(activity, activity.getIntent());
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        Activity activity = getActivity();
        if (activity != null) {
            activity.setIntent(intent);
            ingestIntent(activity, intent);
        }
    }

    @PluginMethod
    public void checkPending(PluginCall call) {
        JSObject value = pending;
        pending = null;
        if (value == null) {
            call.resolve(new JSObject());
            return;
        }
        call.resolve(value);
    }

    public static void ingestIntent(Activity activity, Intent intent) {
        if (activity == null || intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return;
        }

        JSObject payload = new JSObject();
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text != null && !text.trim().isEmpty()) {
            payload.put("text", text.trim());
        }

        Uri stream = null;
        if (Intent.ACTION_SEND.equals(action)) {
            stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        } else {
            Bundle extras = intent.getExtras();
            if (extras != null) {
                Object list = extras.get(Intent.EXTRA_STREAM);
                if (list instanceof java.util.ArrayList && !((java.util.ArrayList<?>) list).isEmpty()) {
                    Object first = ((java.util.ArrayList<?>) list).get(0);
                    if (first instanceof Uri) stream = (Uri) first;
                }
            }
        }

        if (stream != null) {
            try {
                ContentResolver resolver = activity.getContentResolver();
                String mime = resolver.getType(stream);
                if (mime == null) mime = intent.getType();
                if (mime == null) mime = "application/octet-stream";
                String name = queryDisplayName(resolver, stream);
                if (name == null || name.isEmpty()) {
                    String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
                    name = "shared-receipt." + (ext != null ? ext : "bin");
                }

                byte[] bytes = readLimited(resolver, stream, MAX_BYTES);
                if (bytes != null && bytes.length > 0) {
                    payload.put("mimeType", mime);
                    payload.put("fileName", name);
                    payload.put("dataBase64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                }
            } catch (Exception err) {
                payload.put("error", err.getMessage() != null ? err.getMessage() : "Could not read shared file");
            }
        }

        if (!payload.has("text") && !payload.has("dataBase64")) {
            return;
        }

        payload.put("source", "share");
        payload.put("receivedAt", System.currentTimeMillis());
        pending = payload;

        if (instance != null) {
            instance.notifyListeners("shareReceived", payload);
        }
    }

    private static String queryDisplayName(ContentResolver resolver, Uri uri) {
        try (Cursor cursor = resolver.query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) return cursor.getString(idx);
            }
        } catch (Exception ignored) {
            /* fall through */
        }
        return null;
    }

    private static byte[] readLimited(ContentResolver resolver, Uri uri, int maxBytes) throws Exception {
        try (InputStream in = resolver.openInputStream(uri);
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            if (in == null) return null;
            byte[] buf = new byte[16 * 1024];
            int total = 0;
            int n;
            while ((n = in.read(buf)) != -1) {
                total += n;
                if (total > maxBytes) {
                    throw new Exception("Shared file is too large (max 6 MB)");
                }
                out.write(buf, 0, n);
            }
            return out.toByteArray();
        }
    }
}
