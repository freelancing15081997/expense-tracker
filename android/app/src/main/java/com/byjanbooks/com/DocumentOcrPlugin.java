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
 */
@CapacitorPlugin(name = "DocumentOcr")
public class DocumentOcrPlugin extends Plugin {
    private static final int MAX_DECODE_BYTES = 5 * 1024 * 1024;

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

        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
        // Cap decode size for mid-range devices.
        opts.inSampleSize = bytes.length > 1_200_000 ? 2 : 1;
        Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
        if (bitmap == null) {
            call.reject("Could not decode image");
            return;
        }

        InputImage image = InputImage.fromBitmap(bitmap, 0);
        TextRecognizer recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        recognizer.process(image)
            .addOnSuccessListener(result -> {
                JSObject out = new JSObject();
                out.put("text", result.getText() != null ? result.getText() : "");
                out.put("engine", "mlkit");
                call.resolve(out);
                bitmap.recycle();
                recognizer.close();
            })
            .addOnFailureListener(err -> {
                bitmap.recycle();
                recognizer.close();
                call.reject(err.getMessage() != null ? err.getMessage() : "OCR failed");
            });
    }
}
