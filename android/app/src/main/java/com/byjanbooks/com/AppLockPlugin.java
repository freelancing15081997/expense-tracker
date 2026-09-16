package com.byjanbooks.com;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

/**
 * Real device biometric prompt. Never reports success without the system callback.
 */
@CapacitorPlugin(name = "AppLock")
public class AppLockPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BiometricManager mgr = BiometricManager.from(getContext());
        int can = mgr.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
                | BiometricManager.Authenticators.BIOMETRIC_WEAK
        );
        JSObject out = new JSObject();
        out.put("available", can == BiometricManager.BIOMETRIC_SUCCESS);
        out.put("code", can);
        call.resolve(out);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        FragmentActivity activity = getActivity();
        if (activity == null) {
            call.reject("No activity");
            return;
        }
        String reason = call.getString("reason", "Unlock Byjan");
        activity.runOnUiThread(() -> {
            Executor executor = ContextCompat.getMainExecutor(activity);
            BiometricPrompt prompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    JSObject out = new JSObject();
                    out.put("ok", true);
                    call.resolve(out);
                }

                @Override
                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                    JSObject out = new JSObject();
                    out.put("ok", false);
                    out.put("cancelled", errorCode == BiometricPrompt.ERROR_USER_CANCELED
                        || errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                        || errorCode == BiometricPrompt.ERROR_CANCELED);
                    out.put("message", String.valueOf(errString));
                    call.resolve(out);
                }

                @Override
                public void onAuthenticationFailed() {
                    /* keep prompting until success or error */
                }
            });
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock Byjan")
                .setSubtitle(reason)
                .setNegativeButtonText("Use PIN")
                .build();
            try {
                prompt.authenticate(info);
            } catch (Exception e) {
                call.reject(e.getMessage() != null ? e.getMessage() : "Biometric unavailable");
            }
        });
    }
}
