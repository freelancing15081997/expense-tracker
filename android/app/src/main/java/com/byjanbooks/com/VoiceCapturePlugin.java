package com.byjanbooks.com;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;

/**
 * Runtime RECORD_AUDIO + Android SpeechRecognizer.
 * WebView getUserMedia / webkitSpeechRecognition reports "denied" even after the user
 * grants the OS toggle; this native path is the real microphone for voice entry.
 */
@CapacitorPlugin(name = "VoiceCapture")
public class VoiceCapturePlugin extends Plugin {
    private static final int REQ_MIC = 7124;

    private final Handler main = new Handler(Looper.getMainLooper());
    private static VoiceCapturePlugin instance;

    private SpeechRecognizer recognizer;
    private PluginCall pending;
    private Runnable timeoutTask;
    private String pendingMethod = "";

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    static void onOsPermissionResult(int requestCode, int[] grantResults) {
        if (instance == null || requestCode != REQ_MIC) return;
        instance.handleOsPermission(grantResults != null && grantResults.length > 0
            && grantResults[0] == PackageManager.PERMISSION_GRANTED);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject out = new JSObject();
        out.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        out.put("granted", hasMic());
        call.resolve(out);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasMic()) {
            JSObject out = new JSObject();
            out.put("granted", true);
            call.resolve(out);
            return;
        }
        pending = call;
        pendingMethod = "permission";
        requestMic();
    }

    @PluginMethod
    public void listen(PluginCall call) {
        call.setKeepAlive(true);
        if (!hasMic()) {
            pending = call;
            pendingMethod = "listen";
            requestMic();
            return;
        }
        startListen(call);
    }

    private void handleOsPermission(boolean granted) {
        PluginCall call = pending;
        String method = pendingMethod;
        pending = null;
        pendingMethod = "";
        if (call == null) return;
        boolean ok = granted || hasMic();
        if ("permission".equals(method)) {
            JSObject out = new JSObject();
            out.put("granted", ok);
            call.resolve(out);
            return;
        }
        if (!ok) {
            JSObject out = new JSObject();
            out.put("transcript", "");
            out.put("denied", true);
            out.put("error", "Microphone permission denied");
            call.resolve(out);
            return;
        }
        startListen(call);
    }

    private boolean hasMic() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO)
            == PackageManager.PERMISSION_GRANTED;
    }

    private void requestMic() {
        Activity activity = getActivity();
        if (activity == null) {
            PluginCall call = pending;
            pending = null;
            if (call != null) {
                JSObject out = new JSObject();
                out.put("granted", false);
                out.put("transcript", "");
                out.put("denied", true);
                out.put("error", "Microphone permission denied");
                call.resolve(out);
            }
            return;
        }
        ActivityCompat.requestPermissions(activity, new String[]{Manifest.permission.RECORD_AUDIO}, REQ_MIC);
        final PluginCall watching = pending;
        main.postDelayed(new Runnable() {
            int n = 0;
            @Override public void run() {
                if (pending != watching) return;
                if (hasMic()) {
                    handleOsPermission(true);
                    return;
                }
                n += 1;
                if (n < 40) main.postDelayed(this, 400);
            }
        }, 400);
    }

    private void startListen(PluginCall call) {
        final String lang = call.getString("lang", "en-IN");
        final Integer timeoutRaw = call.getInt("timeoutMs");
        final int timeoutMs = timeoutRaw != null ? timeoutRaw : 12000;
        final Activity activity = getActivity();
        if (activity == null) {
            resolveErr(call, "Could not start speech recognition", false);
            return;
        }
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            resolveErr(call, "Speech recognition is not available on this device", false);
            return;
        }
        activity.runOnUiThread(() -> {
            destroyRecognizer();
            pending = call;
            pendingMethod = "listen";
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new RecognitionListener() {
                @Override public void onReadyForSpeech(Bundle params) { /* waiting */ }
                @Override public void onBeginningOfSpeech() { /* speaking */ }
                @Override public void onRmsChanged(float rmsdB) { /* level */ }
                @Override public void onBufferReceived(byte[] buffer) { /* pcm */ }
                @Override public void onEndOfSpeech() { /* done */ }
                @Override public void onPartialResults(Bundle partialResults) { /* unused */ }
                @Override public void onEvent(int eventType, Bundle params) { /* unused */ }

                @Override
                public void onResults(Bundle results) {
                    ArrayList<String> list = results != null
                        ? results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        : null;
                    String text = (list != null && !list.isEmpty()) ? String.valueOf(list.get(0)).trim() : "";
                    finish(text, text.isEmpty() ? "No speech heard" : null, false);
                }

                @Override
                public void onError(int error) {
                    if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) {
                        finish("", "Microphone permission denied", true);
                    } else if (error == SpeechRecognizer.ERROR_NO_MATCH
                        || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT
                        || error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) {
                        finish("", "No speech heard — try again", false);
                    } else {
                        finish("", "Could not recognise speech", false);
                    }
                }
            });
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
            try {
                recognizer.startListening(intent);
            } catch (Exception e) {
                finish("", e.getMessage() != null ? e.getMessage() : "Could not start speech recognition", false);
                return;
            }
            timeoutTask = () -> {
                if (pending == call) {
                    try {
                        if (recognizer != null) recognizer.stopListening();
                    } catch (Exception ignored) { /* already stopped */ }
                }
            };
            main.postDelayed(timeoutTask, timeoutMs);
        });
    }

    private void finish(String transcript, String error, boolean denied) {
        PluginCall call = pending;
        pending = null;
        pendingMethod = "";
        if (timeoutTask != null) {
            main.removeCallbacks(timeoutTask);
            timeoutTask = null;
        }
        destroyRecognizer();
        if (call == null) return;
        JSObject out = new JSObject();
        out.put("transcript", transcript != null ? transcript : "");
        if (error != null && !error.isEmpty()) out.put("error", error);
        if (denied) out.put("denied", true);
        call.resolve(out);
    }

    private void resolveErr(PluginCall call, String error, boolean denied) {
        JSObject out = new JSObject();
        out.put("transcript", "");
        out.put("error", error);
        if (denied) out.put("denied", true);
        call.resolve(out);
    }

    private void destroyRecognizer() {
        if (timeoutTask != null) {
            main.removeCallbacks(timeoutTask);
            timeoutTask = null;
        }
        if (recognizer != null) {
            try { recognizer.cancel(); } catch (Exception ignored) { /* already gone */ }
            try { recognizer.destroy(); } catch (Exception ignored) { /* already gone */ }
            recognizer = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        destroyRecognizer();
        instance = null;
        super.handleOnDestroy();
    }
}
