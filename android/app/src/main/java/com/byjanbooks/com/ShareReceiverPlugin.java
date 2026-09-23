package com.byjanbooks.com;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Receives Android ACTION_SEND shares (images / text) into the Capacitor bridge.
 * Large images stay in static pending and are fetched via checkPending — the event
 * only carries a light signal so the JS bridge never drops the second share.
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {
    private static final int MAX_BYTES = 6 * 1024 * 1024;
    /** Bridge events above ~500KB often fail silently on warm shares. */
    private static final int LIGHT_EVENT_MAX_B64 = 180_000;
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

        java.util.ArrayList<Uri> streams = new java.util.ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri one = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (one != null) streams.add(one);
        } else {
            java.util.ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (list != null) {
                for (Uri uri : list) {
                    if (uri != null) streams.add(uri);
                    if (streams.size() >= 8) break;
                }
            }
        }

        JSArray files = new JSArray();
        for (int i = 0; i < streams.size(); i++) {
            Uri stream = streams.get(i);
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
                    JSObject file = new JSObject();
                    file.put("mimeType", mime);
                    file.put("fileName", name);
                    file.put("dataBase64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                    file.put("byteLength", bytes.length);
                    files.put(file);
                    if (i == 0) {
                        payload.put("mimeType", mime);
                        payload.put("fileName", name);
                        payload.put("dataBase64", file.getString("dataBase64"));
                        payload.put("byteLength", bytes.length);
                    }
                }
            } catch (Exception err) {
                if (!payload.has("error")) {
                    payload.put("error", err.getMessage() != null ? err.getMessage() : "Could not read shared file");
                }
            }
        }
        if (files.length() > 0) {
            payload.put("files", files);
            payload.put("fileCount", files.length());
        }

        if (!payload.has("text") && !payload.has("dataBase64")) {
            return;
        }

        payload.put("source", "share");
        payload.put("receivedAt", System.currentTimeMillis());
        pending = payload;

        if (instance != null) {
            // Always notify lightly — JS pulls full base64 via checkPending.
            JSObject light = new JSObject();
            light.put("hasPending", true);
            light.put("source", "share");
            if (payload.has("receivedAt")) {
                try {
                    light.put("receivedAt", payload.getLong("receivedAt"));
                } catch (Exception ignored) {
                    light.put("receivedAt", System.currentTimeMillis());
                }
            }
            if (payload.has("mimeType")) light.put("mimeType", payload.getString("mimeType"));
            if (payload.has("fileName")) light.put("fileName", payload.getString("fileName"));
            if (payload.has("byteLength")) {
                try {
                    light.put("byteLength", payload.getInteger("byteLength"));
                } catch (Exception ignored) { /* optional */ }
            }
            String shareText = payload.has("text") ? payload.getString("text") : null;
            if (shareText != null && shareText.length() < 4000) {
                light.put("text", shareText);
            }
            // Tiny images can ride the event; large ones must use checkPending.
            if (payload.has("dataBase64")) {
                String b64 = payload.getString("dataBase64");
                if (b64 != null && b64.length() > 0 && b64.length() < LIGHT_EVENT_MAX_B64) {
                    light.put("dataBase64", b64);
                }
            }
            instance.notifyListeners("shareReceived", light);
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
