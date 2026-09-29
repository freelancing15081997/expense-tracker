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
    private static final int MAX_DECODE_BYTES = 12 * 1024 * 1024;
    private static final int MAX_PDF_PAGES = 3;
    private static final int DECODE_LONG_EDGE = 1600;
    private static final int PADDLE_LONG_EDGE = 1280;

    /** Wall-clock budget per document — extra time is reserved for a right-column amount pass. */
    private static final long BUDGET_MS = 3400;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final AtomicBoolean paddleReady = new AtomicBoolean(false);
    private final AtomicBoolean paddleTried = new AtomicBoolean(false);
    private final AtomicBoolean paddleBusy = new AtomicBoolean(false);
    private volatile CountDownLatch paddleInitLatch;
    private OCR paddle;
    private TextRecognizer mlkit;

    private synchronized TextRecognizer mlkitClient() {
        if (mlkit == null) {
            mlkit = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        }
        return mlkit;
    }

    @Override
    public void load() {
        super.load();
        // Warm both engines at app start so the first share/scan doesn't pay model-load time.
        startPaddleInit();
        try { mlkitClient(); } catch (Throwable ignored) { /* lazy later */ }
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
        config.setCpuThreadNum(2);
        config.setCpuPowerMode(CpuPowerMode.LITE_POWER_HIGH);
        config.setDrwwTextPositionBox(false);
        return config;
    }

    /** Kick off PP-OCRv4 model load without blocking. Safe to call repeatedly. */
    private void startPaddleInit() {
        if (paddleReady.get()) return;
        if (!paddleTried.compareAndSet(false, true)) return;
        final CountDownLatch latch = new CountDownLatch(1);
        paddleInitLatch = latch;
        main.post(() -> {
            try {
                if (paddle == null) {
                    paddle = new OCR(getContext());
                }
                paddle.initModel(buildConfig(), new OcrInitCallback() {
                    @Override
                    public void onSuccess() {
                        paddleReady.set(true);
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
    }

    /** Wait at most {@code ms} for the model to be ready; never blocks a scan for model load. */
    private boolean awaitPaddle(long ms) {
        if (paddleReady.get()) return true;
        startPaddleInit();
        CountDownLatch latch = paddleInitLatch;
        if (latch == null || ms <= 0) return paddleReady.get();
        try {
            latch.await(ms, TimeUnit.MILLISECONDS);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
        return paddleReady.get();
    }

    /**
     * Run PP-OCRv4 with a hard deadline. Returns null when busy, failed, or past deadline.
     * NEVER clear {@link #paddleBusy} or recycle {@code bitmap} on timeout — Paddle-Lite memcpy's
     * pixels on a native thread; freeing them mid-run SIGSEGVs and kills the process.
     */
    private OcrResult runPaddle(Bitmap bitmap, long timeoutMs) {
        if (timeoutMs <= 0 || !paddleReady.get() || bitmap == null || bitmap.isRecycled()) return null;
        if (!paddleBusy.compareAndSet(false, true)) return null;
        final Bitmap held = downscaleForPaddle(bitmap);
        CountDownLatch latch = new CountDownLatch(1);
        AtomicReference<OcrResult> resultRef = new AtomicReference<>();
        AtomicReference<Throwable> errRef = new AtomicReference<>();

        main.post(() -> {
            try {
                if (held == null || held.isRecycled()) {
                    paddleBusy.set(false);
                    latch.countDown();
                    return;
                }
                paddle.run(held, new OcrRunCallback() {
                    @Override
                    public void onSuccess(OcrResult result) {
                        resultRef.set(result);
                        releasePaddleBitmap(held, bitmap);
                        paddleBusy.set(false);
                        latch.countDown();
                    }

                    @Override
                    public void onFail(Throwable e) {
                        errRef.set(e);
                        releasePaddleBitmap(held, bitmap);
                        paddleBusy.set(false);
                        latch.countDown();
                    }
                });
            } catch (Throwable t) {
                errRef.set(t);
                releasePaddleBitmap(held, bitmap);
                paddleBusy.set(false);
                latch.countDown();
            }
        });

        try {
            if (!latch.await(timeoutMs, TimeUnit.MILLISECONDS)) {
                Log.w(TAG, "PP-OCRv4 run past deadline (" + timeoutMs + "ms) — bitmap stays until native callback");
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

    private static Bitmap downscaleForPaddle(Bitmap src) {
        if (src == null || src.isRecycled()) return src;
        int maxEdge = Math.max(src.getWidth(), src.getHeight());
        if (maxEdge <= PADDLE_LONG_EDGE) return src;
        float scale = PADDLE_LONG_EDGE / (float) maxEdge;
        try {
            return Bitmap.createScaledBitmap(
                src,
                Math.max(1, Math.round(src.getWidth() * scale)),
                Math.max(1, Math.round(src.getHeight() * scale)),
                true
            );
        } catch (Throwable t) {
            return src;
        }
    }

    private static void releasePaddleBitmap(Bitmap held, Bitmap original) {
        if (held != null && held != original && !held.isRecycled()) held.recycle();
    }

    private void safeRecycle(Bitmap bmp) {
        if (bmp != null && !bmp.isRecycled() && !paddleBusy.get()) bmp.recycle();
    }

    /** ML Kit started asynchronously so it overlaps with PP-OCRv4. */
    private static final class MlJob {
        final CountDownLatch latch = new CountDownLatch(1);
        final AtomicReference<String> text = new AtomicReference<>("");
    }

    private MlJob startMlkit(Bitmap bitmap) {
        MlJob job = new MlJob();
        try {
            InputImage image = InputImage.fromBitmap(bitmap, 0);
            mlkitClient().process(image)
                .addOnSuccessListener(vision -> {
                    job.text.set(vision.getText() != null ? vision.getText() : "");
                    job.latch.countDown();
                })
                .addOnFailureListener(err -> {
                    Log.w(TAG, "ML Kit page failed", err);
                    job.latch.countDown();
                });
        } catch (Throwable t) {
            Log.w(TAG, "ML Kit start failed", t);
            job.latch.countDown();
        }
        return job;
    }

    private String awaitMlkit(MlJob job, long timeoutMs) {
        try {
            job.latch.await(Math.max(50, timeoutMs), TimeUnit.MILLISECONDS);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
        return job.text.get();
    }

    /**
     * One page → {primary, secondary} texts. If the upright pass reads nothing with digits
     * (sideways handwritten chit, landscape photo of a portrait bill) retry rotated 90° / 270°
     * inside a short grace window — a blank result is never "fast", it just moves the work to the user.
     */
    private String[] ocrPage(Bitmap bitmap, long deadlineAt) {
        String[] first = ocrPageOnce(bitmap, deadlineAt);
        if (hasUsefulText(first[0]) || hasUsefulText(first[1])) return first;
        long now = android.os.SystemClock.elapsedRealtime();
        for (int degrees : new int[] { 90, 270 }) {
            long grace = Math.min(now + 1300, deadlineAt + 1800);
            if (grace - android.os.SystemClock.elapsedRealtime() < 500) break;
            Bitmap turned = rotate(bitmap.copy(bitmap.getConfig() != null ? bitmap.getConfig() : Bitmap.Config.ARGB_8888, false), degrees);
            try {
                String[] again = ocrPageOnce(turned, grace);
                if (hasUsefulText(again[0]) || hasUsefulText(again[1])) {
                    Log.i(TAG, "OCR succeeded after rotating " + degrees + "°");
                    return again;
                }
            } finally {
                safeRecycle(turned);
            }
            now = android.os.SystemClock.elapsedRealtime();
        }
        return first;
    }

    private String[] ocrPageOnce(Bitmap bitmap, long deadlineAt) {
        MlJob ml = startMlkit(bitmap);
        String paddleText = "";
        float inferMs = 0;
        long remaining = deadlineAt - android.os.SystemClock.elapsedRealtime();
        if (remaining > 500 && !paddleBusy.get() && awaitPaddle(Math.min(remaining - 400, 1200))) {
            remaining = deadlineAt - android.os.SystemClock.elapsedRealtime();
            OcrResult result = runPaddle(bitmap, remaining);
            if (result != null && result.getSimpleText() != null) {
                paddleText = result.getSimpleText().trim();
                inferMs = result.getInferenceTime();
            }
        }
        // ML Kit is fast (~0.3–1s); give it the remainder of the budget plus a small grace window.
        long mlWait = Math.max(700, deadlineAt + 900 - android.os.SystemClock.elapsedRealtime());
        String mlText = awaitMlkit(ml, mlWait).trim();
        lastInferMs = inferMs;
        if (!paddleText.isEmpty()) return new String[] { paddleText, mlText };
        return new String[] { mlText, "" };
    }

    /** Right-column ₹ pass — ML Kit only, never Paddle (native crash on recycled strip). */
    private String[] ocrStripMlkit(Bitmap bitmap, long deadlineAt) {
        if (bitmap == null || bitmap.isRecycled()) return new String[] { "", "" };
        MlJob ml = startMlkit(bitmap);
        long mlWait = Math.max(300, deadlineAt - android.os.SystemClock.elapsedRealtime());
        String mlText = awaitMlkit(ml, mlWait).trim();
        return new String[] { mlText, "" };
    }

    private volatile float lastInferMs = 0;

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

    private boolean looksLikeReadablePdfText(String text) {
        if (text == null) return false;
        int letters = 0;
        int printable = 0;
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            if ((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z')) letters++;
            if (c == '\n' || c == '\r' || c == '\t' || c == '₹' || (c >= 32 && c < 127)) printable++;
        }
        return letters >= 20 && printable * 10 >= text.length() * 7;
    }

    private Bitmap decodeImageBitmap(byte[] bytes) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
        Bitmap bmp = decodeSampled(bounds, (opts) -> BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts));
        if (bmp == null) return null;
        int degrees = exifRotation(bytes);
        return degrees == 0 ? bmp : rotate(bmp, degrees);
    }

    private Bitmap decodeImageFile(String path) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(path, bounds);
        Bitmap bmp = decodeSampled(bounds, (opts) -> BitmapFactory.decodeFile(path, opts));
        if (bmp == null) return null;
        int degrees = 0;
        try {
            android.media.ExifInterface exif = new android.media.ExifInterface(path);
            int o = exif.getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, android.media.ExifInterface.ORIENTATION_NORMAL);
            if (o == android.media.ExifInterface.ORIENTATION_ROTATE_90) degrees = 90;
            else if (o == android.media.ExifInterface.ORIENTATION_ROTATE_180) degrees = 180;
            else if (o == android.media.ExifInterface.ORIENTATION_ROTATE_270) degrees = 270;
        } catch (Throwable ignored) { /* PNG / no EXIF */ }
        return degrees == 0 ? bmp : rotate(bmp, degrees);
    }

    private interface BitmapDecode {
        Bitmap decode(BitmapFactory.Options opts);
    }

    private static Bitmap decodeSampled(BitmapFactory.Options bounds, BitmapDecode decoder) {
        int sample = 1;
        int maxEdge = Math.max(bounds.outWidth, bounds.outHeight);
        while (maxEdge / sample > DECODE_LONG_EDGE) sample *= 2;
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
        opts.inSampleSize = sample;
        return decoder.decode(opts);
    }

    private static int exifRotation(byte[] bytes) {
        try {
            android.media.ExifInterface exif = new android.media.ExifInterface(new java.io.ByteArrayInputStream(bytes));
            int o = exif.getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, android.media.ExifInterface.ORIENTATION_NORMAL);
            if (o == android.media.ExifInterface.ORIENTATION_ROTATE_90) return 90;
            if (o == android.media.ExifInterface.ORIENTATION_ROTATE_180) return 180;
            if (o == android.media.ExifInterface.ORIENTATION_ROTATE_270) return 270;
        } catch (Throwable ignored) { /* PNG / no EXIF */ }
        return 0;
    }

    private static Bitmap rotate(Bitmap src, int degrees) {
        if (src == null || degrees % 360 == 0) return src;
        android.graphics.Matrix m = new android.graphics.Matrix();
        m.postRotate(degrees);
        try {
            Bitmap out = Bitmap.createBitmap(src, 0, 0, src.getWidth(), src.getHeight(), m, true);
            if (out != src) src.recycle();
            return out;
        } catch (Throwable t) {
            return src;
        }
    }

    /** "Read something useful": a digit run (amount / date / id), including a lone ₹1. */
    private static boolean hasUsefulText(String text) {
        if (text == null) return false;
        int digitLines = 0;
        for (String line : text.split("\n")) {
            if (line.matches(".*\\d+.*")) digitLines++;
            if (digitLines >= 1) return true;
        }
        return false;
    }

    private static boolean looksLikeUpiReceipt(String text) {
        if (text == null) return false;
        String t = text.toLowerCase();
        return t.contains("received from") || t.contains("paid to") || t.contains("transaction successful")
            || t.contains("money received") || t.contains("payment successful") || t.contains("credited to")
            || t.contains("debited from");
    }

    /** PhonePe/Paytm put ₹ on the right of the party row. Crop + 2× so ML Kit can read ₹1. */
    private static Bitmap cropAmountColumn(Bitmap src) {
        if (src == null) return null;
        int w = src.getWidth();
        int h = src.getHeight();
        if (w < 120 || h < 120) return null;
        int x = Math.round(w * 0.58f);
        int cropW = Math.max(80, w - x);
        int y = Math.round(h * 0.08f);
        int cropH = Math.max(80, Math.round(h * 0.74f));
        if (x + cropW > w) cropW = w - x;
        if (y + cropH > h) cropH = h - y;
        try {
            Bitmap strip = Bitmap.createBitmap(src, x, y, cropW, cropH);
            int maxW = 720;
            if (strip.getWidth() <= maxW) return strip;
            float s = maxW / (float) strip.getWidth();
            Bitmap small = Bitmap.createScaledBitmap(
                strip,
                maxW,
                Math.max(1, Math.round(strip.getHeight() * s)),
                true
            );
            if (small != strip) strip.recycle();
            return small;
        } catch (Throwable t) {
            return null;
        }
    }

    private static Bitmap enhanceAmountStrip(Bitmap src) {
        if (src == null) return null;
        Bitmap out = src.copy(Bitmap.Config.ARGB_8888, true);
        if (out == null) return src;
        int w = out.getWidth();
        int h = out.getHeight();
        int[] px = new int[w * h];
        out.getPixels(px, 0, w, 0, 0, w, h);
        long sum = 0;
        for (int p : px) {
            sum += ((p >> 16) & 255) + ((p >> 8) & 255) + (p & 255);
        }
        int avg = (int) (sum / Math.max(1L, px.length * 3L));
        if (avg > 120) return src; // already a bright screenshot
        for (int i = 0; i < px.length; i++) {
            int p = px[i];
            int r = Math.min(255, Math.max(0, (int) ((((p >> 16) & 255) - 18) * 1.85)));
            int g = Math.min(255, Math.max(0, (int) ((((p >> 8) & 255) - 18) * 1.85)));
            int b = Math.min(255, Math.max(0, (int) (((p & 255) - 18) * 1.85)));
            px[i] = (p & 0xFF000000) | (r << 16) | (g << 8) | b;
        }
        out.setPixels(px, 0, w, 0, 0, w, h);
        return out;
    }

    private static byte[] readFileBytes(String path) throws Exception {
        java.io.File f = new java.io.File(path);
        if (!f.isFile() || f.length() < 32 || f.length() > MAX_DECODE_BYTES) {
            throw new java.io.IOException("unreadable");
        }
        byte[] bytes = new byte[(int) f.length()];
        try (java.io.FileInputStream in = new java.io.FileInputStream(f)) {
            int off = 0;
            while (off < bytes.length) {
                int n = in.read(bytes, off, bytes.length - off);
                if (n < 0) break;
                off += n;
            }
        }
        return bytes;
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
        final long startedAt = android.os.SystemClock.elapsedRealtime();
        startPaddleInit();
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
            processDecodedBytes(bytes, mime, call, startedAt);
        });
    }

    @PluginMethod
    public void recognizeFile(PluginCall call) {
        String path = call.getString("path", "");
        if (path == null || path.trim().length() < 2) {
            JSObject out = new JSObject();
            out.put("text", "");
            out.put("engine", "empty");
            call.resolve(out);
            return;
        }
        final String filePath = path.trim();
        final long startedAt = android.os.SystemClock.elapsedRealtime();
        startPaddleInit();
        worker.execute(() -> {
            String lower = filePath.toLowerCase();
            boolean pdf = lower.endsWith(".pdf");
            if (pdf) {
                byte[] bytes;
                try {
                    bytes = readFileBytes(filePath);
                } catch (Throwable t) {
                    main.post(() -> call.reject("Could not read document file"));
                    return;
                }
                processDecodedBytes(bytes, "application/pdf", call, startedAt);
                return;
            }
            Bitmap one;
            try {
                one = decodeImageFile(filePath);
            } catch (Throwable t) {
                main.post(() -> call.reject("Could not read document file"));
                return;
            }
            processBitmaps(one != null ? java.util.Collections.singletonList(one) : new ArrayList<>(), "", false, call, startedAt);
        });
    }

    private void processDecodedBytes(byte[] bytes, String mime, PluginCall call, long startedAt) {
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
        boolean pdf = looksLikePdf(bytes, mime) || engine.contains("pdf");
        processBitmaps(bitmaps, embedded, pdf, call, startedAt);
    }

    private void processBitmaps(List<Bitmap> bitmaps, String embedded, boolean pdf, PluginCall call, long startedAt) {
        if ((bitmaps == null || bitmaps.isEmpty()) && (embedded == null || embedded.length() < 20)) {
            main.post(() -> call.reject("Could not decode document"));
            return;
        }
        if (bitmaps == null) bitmaps = new ArrayList<>();
        String engine = pdf ? (embedded != null && embedded.length() > 20 ? "pdf-text" : "ppocrv4-pdf") : "ppocrv4";
        try {
            StringBuilder all = new StringBuilder();
            StringBuilder alt = new StringBuilder();
            boolean embeddedOk = looksLikeReadablePdfText(embedded);
            if (embeddedOk) all.append(embedded);
            float ms = 0;
            boolean anyPaddle = false;
            boolean anyMlkit = false;
            final long deadlineAt = startedAt + BUDGET_MS;
            for (int i = 0; i < bitmaps.size(); i++) {
                Bitmap bmp = bitmaps.get(i);
                long now = android.os.SystemClock.elapsedRealtime();
                long pagesLeft = bitmaps.size() - i;
                long pageDeadline = pagesLeft > 1 ? now + Math.max(600, (deadlineAt - now) / pagesLeft) : deadlineAt;
                String[] texts = ocrPage(bmp, pageDeadline);
                if (lastInferMs > 0) { anyPaddle = true; ms += lastInferMs; } else if (!texts[0].isEmpty()) { anyMlkit = true; }
                if (!texts[0].isEmpty()) {
                    if (embeddedOk) {
                        if (alt.length() > 0) alt.append('\n');
                        alt.append(texts[0]);
                    } else {
                        if (all.length() > 0) all.append('\n');
                        all.append(texts[0]);
                    }
                }
                if (!texts[1].isEmpty()) {
                    if (alt.length() > 0) alt.append('\n');
                    alt.append(texts[1]);
                }
                if (i == 0 && !pdf
                    && looksLikeUpiReceipt(all.toString() + "\n" + alt.toString())
                    && android.os.SystemClock.elapsedRealtime() + 350 < deadlineAt + 900) {
                    Bitmap strip = cropAmountColumn(bmp);
                    if (strip != null) {
                        Bitmap enhanced = enhanceAmountStrip(strip);
                        try {
                            long stripDeadline = Math.min(deadlineAt + 900, android.os.SystemClock.elapsedRealtime() + 950);
                            String[] extra = ocrStripMlkit(enhanced != null ? enhanced : strip, stripDeadline);
                            if (extra[0] != null && !extra[0].isEmpty()) {
                                if (all.length() > 0) all.append('\n');
                                all.append(extra[0]);
                            }
                        } finally {
                            if (enhanced != null && enhanced != strip) safeRecycle(enhanced);
                            safeRecycle(strip);
                        }
                    }
                }
            }
            if (!bitmaps.isEmpty()) {
                if (anyPaddle) engine = pdf ? "ppocrv4-pdf" : "ppocrv4";
                else if (anyMlkit) engine = pdf ? "mlkit-pdf" : "mlkit";
                if (embeddedOk) engine = "pdf-text";
            }
            JSObject out = new JSObject();
            out.put("text", all.toString());
            out.put("altText", alt.toString());
            out.put("engine", engine);
            out.put("ms", ms);
            out.put("wallMs", android.os.SystemClock.elapsedRealtime() - startedAt);
            out.put("pages", bitmaps.size());
            main.post(() -> call.resolve(out));
        } catch (Throwable t) {
            Log.e(TAG, "OCR failed", t);
            main.post(() -> call.reject(t.getMessage() != null ? t.getMessage() : "OCR failed"));
        } finally {
            for (Bitmap bmp : bitmaps) safeRecycle(bmp);
        }
    }
}
