package com.byjanbooks.com;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.DataFormatException;
import java.util.zip.Inflater;

/**
 * On-device OCR for shared receipts / UPI screenshots / PDF pages.
 * Primary: PaddleOCR Mobile PP-OCRv4 (Paddle-Lite).
 * Fallback: ML Kit if Paddle models fail to load.
 * PDFs: PdfRenderer → bitmap page(s) → OCR (no Gemini on share path).
 */
@CapacitorPlugin(name = "DocumentOcr")
public class DocumentOcrPlugin extends Plugin {
    private static final String TAG = "DocumentOcr";
    private static final int MAX_DECODE_BYTES = 5 * 1024 * 1024;
    private static final int MAX_PDF_PAGES = 3;

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
        // In-progress or recently failed init — skip this call (ML Kit). Failures clear the flag for retry.
        if (paddleTried.get()) return false;
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
                        paddleTried.set(false);
                        latch.countDown();
                    }
                });
            } catch (Throwable t) {
                Log.e(TAG, "PP-OCRv4 init exception", t);
                paddleTried.set(false);
                latch.countDown();
            }
        });

        try {
            if (!latch.await(90, TimeUnit.SECONDS)) {
                Log.e(TAG, "PP-OCRv4 init timed out — will retry next OCR");
                paddleTried.set(false);
                return false;
            }
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
            paddleTried.set(false);
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

    private static boolean looksLikePdf(byte[] bytes, String mimeHint) {
        if (mimeHint != null && mimeHint.toLowerCase().contains("pdf")) return true;
        return bytes.length >= 5
            && bytes[0] == 0x25
            && bytes[1] == 0x50
            && bytes[2] == 0x44
            && bytes[3] == 0x46;
    }

    /** Render up to MAX_PDF_PAGES for on-device OCR. */
    private List<Bitmap> renderPdfPages(byte[] bytes) throws Exception {
        File tmp = File.createTempFile("byjan_ocr_", ".pdf", getContext().getCacheDir());
        List<Bitmap> pages = new ArrayList<>();
        ParcelFileDescriptor fd = null;
        PdfRenderer renderer = null;
        try {
            try (FileOutputStream fos = new FileOutputStream(tmp)) {
                fos.write(bytes);
            }
            fd = ParcelFileDescriptor.open(tmp, ParcelFileDescriptor.MODE_READ_ONLY);
            renderer = new PdfRenderer(fd);
            int pageCount = renderer.getPageCount();
            // Totals often sit on the last page — prefer first + last over only first pages.
            java.util.LinkedHashSet<Integer> pageIndices = new java.util.LinkedHashSet<>();
            if (pageCount <= MAX_PDF_PAGES) {
                for (int i = 0; i < pageCount; i++) pageIndices.add(i);
            } else {
                pageIndices.add(0);
                pageIndices.add(pageCount - 1);
                if (MAX_PDF_PAGES >= 3 && pageCount > 2) pageIndices.add(pageCount - 2);
            }
            for (int i : pageIndices) {
                PdfRenderer.Page page = renderer.openPage(i);
                try {
                    float scale = 2f;
                    int w = Math.max(1, Math.round(page.getWidth() * scale));
                    int h = Math.max(1, Math.round(page.getHeight() * scale));
                    int maxEdge = Math.max(w, h);
                    if (maxEdge > 1600) {
                        float down = 1600f / maxEdge;
                        w = Math.max(1, Math.round(w * down));
                        h = Math.max(1, Math.round(h * down));
                    }
                    Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
                    bmp.eraseColor(Color.WHITE);
                    page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);
                    pages.add(bmp);
                } finally {
                    page.close();
                }
            }
            return pages;
        } finally {
            if (renderer != null) {
                try { renderer.close(); } catch (Throwable ignored) { /* */ }
            }
            if (fd != null) {
                try { fd.close(); } catch (Throwable ignored) { /* */ }
            }
            //noinspection ResultOfMethodCallIgnored
            tmp.delete();
        }
    }

    /** Pull text from PDF content streams so CRED invoices don’t depend on OCR of the ₹ glyph. */
    private String extractPdfEmbeddedText(byte[] bytes) {
        if (bytes == null || bytes.length < 32) return "";
        StringBuilder out = new StringBuilder();
        try {
            String latin = new String(bytes, StandardCharsets.ISO_8859_1);
            int from = 0;
            while (from < latin.length()) {
                int streamAt = latin.indexOf("stream", from);
                if (streamAt < 0) break;
                int dataStart = streamAt + 6;
                if (dataStart < latin.length() && latin.charAt(dataStart) == '\r') dataStart++;
                if (dataStart < latin.length() && latin.charAt(dataStart) == '\n') dataStart++;
                int end = latin.indexOf("endstream", dataStart);
                if (end < 0) break;
                if (end > dataStart && end - dataStart < 800_000) {
                    byte[] chunk = new byte[end - dataStart];
                    System.arraycopy(bytes, dataStart, chunk, 0, chunk.length);
                    String inflated = inflatePdfStream(chunk);
                    String cleaned = pdfStreamToText(inflated);
                    if (cleaned.length() > 4) {
                        if (out.length() > 0) out.append('\n');
                        out.append(cleaned);
                    }
                }
                from = end + 9;
            }
        } catch (Throwable t) {
            Log.w(TAG, "PDF text extract failed", t);
        }
        return out.toString().replaceAll("\\s+", " ").trim();
    }

    private String inflatePdfStream(byte[] chunk) {
        Inflater inf = new Inflater();
        try {
            inf.setInput(chunk);
            byte[] buf = new byte[4096];
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            while (!inf.finished() && bos.size() < 200_000) {
                int n;
                try {
                    n = inf.inflate(buf);
                } catch (DataFormatException e) {
                    return new String(chunk, StandardCharsets.ISO_8859_1);
                }
                if (n <= 0) break;
                bos.write(buf, 0, n);
            }
            if (bos.size() > 16) return bos.toString("ISO-8859-1");
        } catch (Throwable ignored) {
            /* fall through */
        } finally {
            inf.end();
        }
        return new String(chunk, StandardCharsets.ISO_8859_1);
    }

    private String pdfStreamToText(String stream) {
        if (stream == null || stream.isEmpty()) return "";
        StringBuilder b = new StringBuilder();
        Matcher m = Pattern.compile("\\((?:\\\\.|[^\\\\)]){1,120}\\)").matcher(stream);
        while (m.find()) {
            String lit = m.group();
            lit = lit.substring(1, lit.length() - 1)
                .replace("\\n", " ")
                .replace("\\r", " ")
                .replace("\\t", " ")
                .replace("\\(", "(")
                .replace("\\)", ")");
            if (lit.trim().length() > 0) b.append(' ').append(lit);
        }
        if (b.length() < 12) {
            for (int i = 0; i < stream.length(); i++) {
                char c = stream.charAt(i);
                if (c == '\u20b9' || c == '₹' || (c >= 32 && c < 127)) b.append(c);
            }
        }
        return b.toString().replaceAll("\\s+", " ").trim();
    }

    private Bitmap decodeImageBitmap(byte[] bytes) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        int sample = 1;
        int maxEdge = Math.max(bounds.outWidth, bounds.outHeight);
        // Prefer sharp digits for receipt totals — 1920 long edge (was 1600 + forced sample on large shares).
        while (maxEdge / sample > 1920) sample *= 2;

        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
        opts.inSampleSize = sample;
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
    }

    private String ocrBitmap(Bitmap bitmap) {
        if (bitmap == null) return "";
        try {
            if (ensurePaddle()) {
                OcrResult result = runPaddle(bitmap);
                if (result != null && result.getSimpleText() != null) {
                    return result.getSimpleText();
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "PP-OCRv4 page failed", t);
        }
        try {
            CountDownLatch latch = new CountDownLatch(1);
            AtomicReference<String> textRef = new AtomicReference<>("");
            InputImage image = InputImage.fromBitmap(bitmap, 0);
            mlkitClient().process(image)
                .addOnSuccessListener(vision -> {
                    textRef.set(vision.getText() != null ? vision.getText() : "");
                    latch.countDown();
                })
                .addOnFailureListener(err -> latch.countDown());
            latch.await(45, TimeUnit.SECONDS);
            return textRef.get();
        } catch (Throwable t) {
            Log.w(TAG, "ML Kit page failed", t);
            return "";
        }
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
        String mimeHint = call.getString("mimeType", "");
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
            call.reject("Document too large for on-device OCR");
            return;
        }

        final String b64 = raw;
        final String mime = mimeHint != null ? mimeHint : "";
        worker.execute(() -> {
            byte[] bytes;
            try {
                bytes = Base64.decode(b64, Base64.DEFAULT);
            } catch (Exception err) {
                main.post(() -> call.reject("Invalid document data"));
                return;
            }
            if (bytes == null || bytes.length < 32) {
                JSObject out = new JSObject();
                out.put("text", "");
                out.put("engine", "empty");
                main.post(() -> call.resolve(out));
                return;
            }

            List<Bitmap> bitmaps = new ArrayList<>();
            String engine = "ppocrv4";
            String embedded = "";
            try {
                if (looksLikePdf(bytes, mime)) {
                    embedded = extractPdfEmbeddedText(bytes);
                    try {
                        bitmaps.addAll(renderPdfPages(bytes));
                    } catch (Throwable renderErr) {
                        Log.w(TAG, "PdfRenderer failed, using embedded text", renderErr);
                    }
                    engine = embedded.length() > 20 ? "pdf-text" : "ppocrv4-pdf";
                } else {
                    Bitmap one = decodeImageBitmap(bytes);
                    if (one != null) bitmaps.add(one);
                }
            } catch (Throwable t) {
                Log.e(TAG, "Decode/render failed", t);
                if (embedded.length() < 20) {
                    main.post(() -> call.reject("Could not read document"));
                    return;
                }
            }

            if (bitmaps.isEmpty() && embedded.length() < 20) {
                main.post(() -> call.reject("Could not decode document"));
                return;
            }

            try {
                StringBuilder all = new StringBuilder();
                if (embedded.length() > 0) all.append(embedded);
                float ms = 0;
                boolean usedPaddle = !bitmaps.isEmpty() && ensurePaddle();
                for (int i = 0; i < bitmaps.size(); i++) {
                    Bitmap bmp = bitmaps.get(i);
                    String pageText;
                    if (usedPaddle) {
                        OcrResult result = runPaddle(bmp);
                        if (result != null) {
                            pageText = result.getSimpleText() != null ? result.getSimpleText() : "";
                            ms += result.getInferenceTime();
                        } else {
                            pageText = ocrBitmap(bmp);
                            engine = engine.contains("pdf") ? "mlkit-pdf" : "mlkit";
                        }
                    } else if (!bitmaps.isEmpty()) {
                        pageText = ocrBitmap(bmp);
                        engine = engine.contains("pdf") ? "mlkit-pdf" : "mlkit";
                    } else {
                        pageText = "";
                    }
                    if (pageText != null && !pageText.isEmpty()) {
                        if (all.length() > 0) all.append('\n');
                        all.append(pageText.trim());
                    }
                }

                JSObject out = new JSObject();
                out.put("text", all.toString());
                out.put("engine", engine);
                out.put("ms", ms);
                out.put("pages", bitmaps.size());
                main.post(() -> call.resolve(out));
            } catch (Throwable t) {
                Log.e(TAG, "OCR failed", t);
                main.post(() -> call.reject(t.getMessage() != null ? t.getMessage() : "OCR failed"));
            } finally {
                for (Bitmap bmp : bitmaps) {
                    if (bmp != null && !bmp.isRecycled()) bmp.recycle();
                }
            }
        });
    }
}
