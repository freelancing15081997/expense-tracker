package com.byjanbooks.app;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.ArrayList;

/**
 * Receives ACTION_SEND / ACTION_SEND_MULTIPLE from the Android share sheet
 * (UPI screenshots, gallery photos, PDFs, SMS text, email text).
 * JS contract (unchanged from the live app): checkPending() and 'shareReceived'.
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {
    private static final int MAX_BYTES = 12 * 1024 * 1024;
    private JSObject pending;

    @Override
    public void load() {
        handle(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        handle(intent);
    }

    @PluginMethod
    public void checkPending(PluginCall call) {
        if (pending == null) { call.resolve(new JSObject()); return; }
        JSObject out = pending;
        pending = null;
        call.resolve(out);
    }

    private void handle(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;
        JSObject payload = new JSObject();
        try {
            String text = intent.getStringExtra(Intent.EXTRA_TEXT);
            String subject = intent.getStringExtra(Intent.EXTRA_SUBJECT);
            if (subject != null && text != null) text = subject + "\n" + text;
            else if (subject != null) text = subject;
            if (text != null) payload.put("text", text);

            ArrayList<Uri> uris = new ArrayList<>();
            if (Intent.ACTION_SEND.equals(action)) {
                Uri u = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (u != null) uris.add(u);
            } else {
                ArrayList<Uri> list = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (list != null) uris.addAll(list);
            }
            JSArray files = new JSArray();
            for (Uri uri : uris) {
                JSObject f = readUri(uri, intent.getType());
                if (f != null) files.put(f);
            }
            if (files.length() > 0) {
                JSObject first = (JSObject) files.get(0);
                payload.put("mimeType", first.getString("mimeType"));
                payload.put("fileName", first.getString("fileName"));
                payload.put("dataBase64", first.getString("dataBase64"));
                payload.put("byteLength", first.getInteger("byteLength"));
                payload.put("files", files);
                payload.put("fileCount", files.length());
            }
            payload.put("source", detectSource(intent));
            payload.put("receivedAt", System.currentTimeMillis());
        } catch (Exception e) {
            payload.put("error", "Could not read the shared item. Try sharing it again.");
        }
        pending = payload;
        JSObject light = new JSObject();
        light.put("hasPending", true);
        light.put("receivedAt", payload.optLong("receivedAt"));
        notifyListeners("shareReceived", light, true);
        intent.setAction(Intent.ACTION_MAIN); // don't re-handle on rotation
    }

    private String detectSource(Intent intent) {
        String ref = getActivity().getReferrer() != null ? getActivity().getReferrer().getHost() : "";
        if (ref == null) ref = "";
        if (ref.contains("phonepe")) return "phonepe";
        if (ref.contains("paisa") || ref.contains("google.android.apps.nbu")) return "gpay";
        if (ref.contains("paytm")) return "paytm";
        if (ref.contains("messaging") || ref.contains("mms")) return "sms";
        if (ref.contains("gm") || ref.contains("mail")) return "email";
        if (ref.contains("whatsapp")) return "whatsapp";
        return "share";
    }

    private JSObject readUri(Uri uri, String fallbackType) throws Exception {
        ContentResolver cr = getContext().getContentResolver();
        String mime = cr.getType(uri);
        if (mime == null) mime = fallbackType != null ? fallbackType : "application/octet-stream";
        String name = "shared";
        try (Cursor c = cr.query(uri, null, null, null, null)) {
            if (c != null && c.moveToFirst()) {
                int idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (idx >= 0) name = c.getString(idx);
            }
        }
        try (InputStream in = cr.openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[16384];
            int n; int total = 0;
            while ((n = in.read(buf)) > 0) {
                total += n;
                if (total > MAX_BYTES) throw new Exception("too large");
                out.write(buf, 0, n);
            }
            JSObject f = new JSObject();
            f.put("mimeType", mime);
            f.put("fileName", name);
            f.put("byteLength", total);
            f.put("dataBase64", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            return f;
        }
    }
}
