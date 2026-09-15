package com.byjanbooks.com;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/**
 * On-device OCR via ML Kit — primary path for UPI / receipt shares (Gemini is fallback).
 * Reuses one recognizer; never recycles the bitmap until ML Kit finishes.
 */
@CapacitorPlugin(name = "DocumentOcr")
public class DocumentOcrPlugin extends Plugin {
    private static final int MAX_DECODE_BYTES = 5 * 1024 * 1024;
    private TextRecognizer recognizer;

    private TextRecognizer client() {
        if (recognizer == null) {
            recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        }
        return recognizer;
    }

    @Override
    protected void handleOnDestroy() {
        if (recognizer != null) {
            recognizer.close();
            recognizer = null;
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void recognizeBase64(PluginCall call) {
        String raw = call.getString("base64", "");
        if (raw == null) raw = "";
        raw = raw.replaceFirst("^data:[^;]+;base64,", "").replaceAll("\\s+", "");
        if (raw.length() < 64) {
            JSObject out = new JSObject();
            out.put("text", "");
            out.put("engine", "empty");
            call.resolve(out);
            return;
        }
        if (raw.length() > MAX_DECODE_BYTES * 2) {
            call.reject("Image too large for on-device OCR");
            return;
        }

        byte[] bytes;
        try {
            bytes = Base64.decode(raw, Base64.DEFAULT);
        } catch (Exception err) {
            call.reject("Invalid image data");
            return;
        }
        if (bytes == null || bytes.length < 32) {
            JSObject out = new JSObject();
            out.put("text", "");
            out.put("engine", "empty");
            call.resolve(out);
            return;
        }

        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        int sample = 1;
        int maxEdge = Math.max(bounds.outWidth, bounds.outHeight);
        while (maxEdge / sample > 2000) sample *= 2;
        if (bytes.length > 1_800_000 && sample < 2) sample = 2;

        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
        opts.inSampleSize = sample;
        final Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
        if (bitmap == null) {
            call.reject("Could not decode image");
            return;
        }

        InputImage image = InputImage.fromBitmap(bitmap, 0);
        client().process(image)
            .addOnSuccessListener(result -> {
                JSObject out = new JSObject();
                out.put("text", result.getText() != null ? result.getText() : "");
                out.put("engine", "mlkit");
                call.resolve(out);
                if (!bitmap.isRecycled()) bitmap.recycle();
            })
            .addOnFailureListener(err -> {
                if (!bitmap.isRecycled()) bitmap.recycle();
                call.reject(err.getMessage() != null ? err.getMessage() : "OCR failed");
            });
    }
}
