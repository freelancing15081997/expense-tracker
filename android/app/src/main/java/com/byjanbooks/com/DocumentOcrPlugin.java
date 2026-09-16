package com.byjanbooks.com;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;

import com.equationl.paddleocr4android.CpuPowerMode;
import com.equationl.paddleocr4android.OCR;
import com.equationl.paddleocr4android.OcrConfig;
import com.equationl.paddleocr4android.bean.OcrResult;
import com.equationl.paddleocr4android.callback.OcrInitCallback;
import com.equationl.paddleocr4android.callback.OcrRunCallback;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * On-device OCR for shared receipts / UPI screenshots.
 * Primary: PaddleOCR Mobile PP-OCRv4 (Paddle-Lite).
 * Fallback: ML Kit if Paddle models fail to load.
 *
 * Uses paddleocr4android callback APIs (Kotlin Result is not callable from Java).
 */
@CapacitorPlugin(name = "DocumentOcr")
public class DocumentOcrPlugin extends Plugin {
    private static final String TAG = "DocumentOcr";
    private static final int MAX_DECODE_BYTES = 5 * 1024 * 1024;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean paddleReady = new AtomicBoolean(false);
    private final AtomicBoolean paddleTried = new AtomicBoolean(false);
    private OCR paddle;
    private TextRecognizer mlkit;

    private TextRecognizer mlkitClient() {
        if (mlkit == null) {
            mlkit = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        }
        return mlkit;
    }

    private OcrConfig buildConfig() {
        OcrConfig config = new OcrConfig();
        config.setModelPath("models/ch_PP-OCRv4");
        config.setLabelPath("labels/ppocr_keys_v1.txt");
        config.setDetModelFilename("det.nb");
        config.setRecModelFilename("rec.nb");
        config.setClsModelFilename("cls.nb");
        config.setRunDet(true);
        config.setRunCls(true);
        config.setRunRec(true);
        config.setCpuThreadNum(4);
        config.setCpuPowerMode(CpuPowerMode.LITE_POWER_FULL);
        config.setDrwwTextPositionBox(false);
        return config;
    }

    private boolean ensurePaddle() {
        if (paddleReady.get()) return true;
        if (paddleTried.get() && !paddleReady.get()) return false;
        paddleTried.set(true);

        CountDownLatch latch = new CountDownLatch(1);
        AtomicBoolean ok = new AtomicBoolean(false);

        main.post(() -> {
            try {
                if (paddle == null) {
                    paddle = new OCR(getContext());
                }
                paddle.initModel(buildConfig(), new OcrInitCallback() {
                    @Override
                    public void onSuccess() {
                        paddleReady.set(true);
                        ok.set(true);
                        Log.i(TAG, "PP-OCRv4 models loaded");
                        latch.countDown();
                    }

                    @Override
                    public void onFail(Throwable e) {
                        Log.e(TAG, "PP-OCRv4 init failed", e);
                        latch.countDown();
                    }
                });
            } catch (Throwable t) {
                Log.e(TAG, "PP-OCRv4 init exception", t);
                latch.countDown();
            }
        });

        try {
            if (!latch.await(90, TimeUnit.SECONDS)) {
                Log.e(TAG, "PP-OCRv4 init timed out");
                return false;
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            return false;
        }
        return ok.get();
    }

    private OcrResult runPaddle(Bitmap bitmap) {
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<OcrResult> resultRef = new AtomicReference<>();
        AtomicReference<Throwable> errRef = new AtomicReference<>();

        main.post(() -> {
            try {
                paddle.run(bitmap, new OcrRunCallback() {
                    @Override
                    public void onSuccess(OcrResult result) {
                        resultRef.set(result);
                        latch.countDown();
                    }

                    @Override
                    public void onFail(Throwable e) {
                        errRef.set(e);
                        latch.countDown();
                    }
                });
            } catch (Throwable t) {
                errRef.set(t);
                latch.countDown();
            }
        });

        try {
            if (!latch.await(60, TimeUnit.SECONDS)) {
                Log.w(TAG, "PP-OCRv4 run timed out");
                return null;
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            return null;
        }
        if (errRef.get() != null) {
            Log.w(TAG, "PP-OCRv4 run failed", errRef.get());
            return null;
        }
        return resultRef.get();
    }

    @Override
    protected void handleOnDestroy() {
        worker.shutdownNow();
        if (paddle != null) {
            try { paddle.releaseModel(); } catch (Throwable ignored) { /* */ }
            paddle = null;
        }
        paddleReady.set(false);
        if (mlkit != null) {
            mlkit.close();
            mlkit = null;
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

        final String b64 = raw;
        worker.execute(() -> {
            byte[] bytes;
            try {
                bytes = Base64.decode(b64, Base64.DEFAULT);
            } catch (Exception err) {
                main.post(() -> call.reject("Invalid image data"));
                return;
            }
            if (bytes == null || bytes.length < 32) {
                JSObject out = new JSObject();
                out.put("text", "");
                out.put("engine", "empty");
                main.post(() -> call.resolve(out));
                return;
            }

            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            int sample = 1;
            int maxEdge = Math.max(bounds.outWidth, bounds.outHeight);
            while (maxEdge / sample > 1600) sample *= 2;
            if (bytes.length > 2_400_000 && sample < 2) sample = 2;

            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
            opts.inSampleSize = sample;
            final Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
            if (bitmap == null) {
                main.post(() -> call.reject("Could not decode image"));
                return;
            }

            try {
                if (ensurePaddle()) {
                    OcrResult result = runPaddle(bitmap);
                    if (result != null) {
                        String text = result.getSimpleText() != null ? result.getSimpleText() : "";
                        JSObject out = new JSObject();
                        out.put("text", text);
                        out.put("engine", "ppocrv4");
                        out.put("ms", result.getInferenceTime());
                        if (!bitmap.isRecycled()) bitmap.recycle();
                        main.post(() -> call.resolve(out));
                        return;
                    }
                    Log.w(TAG, "PP-OCRv4 run empty, falling back to ML Kit");
                }
            } catch (Throwable t) {
                Log.w(TAG, "PP-OCRv4 crashed, falling back to ML Kit", t);
            }

            try {
                InputImage image = InputImage.fromBitmap(bitmap, 0);
                mlkitClient().process(image)
                    .addOnSuccessListener(vision -> {
                        JSObject out = new JSObject();
                        out.put("text", vision.getText() != null ? vision.getText() : "");
                        out.put("engine", "mlkit");
                        call.resolve(out);
                        if (!bitmap.isRecycled()) bitmap.recycle();
                    })
                    .addOnFailureListener(err -> {
                        if (!bitmap.isRecycled()) bitmap.recycle();
                        call.reject(err.getMessage() != null ? err.getMessage() : "OCR failed");
                    });
            } catch (Throwable t) {
                if (!bitmap.isRecycled()) bitmap.recycle();
                main.post(() -> call.reject(t.getMessage() != null ? t.getMessage() : "OCR failed"));
            }
        });
    }
}
