package com.byjanbooks.com;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Launches a real UPI intent and returns the UPI app's result extras when available.
 * Opening an app alone is not success — only explicit Status/response fields are reported.
 */
@CapacitorPlugin(name = "UpiPay")
public class UpiPayPlugin extends Plugin {

    @PluginMethod
    public void pay(PluginCall call) {
        String uri = call.getString("uri", "");
        if (uri == null || uri.trim().isEmpty()) {
            call.reject("Missing UPI URI");
            return;
        }
        String pkg = call.getString("packageName", "");
        Intent intent = payIntent(uri.trim(), pkg);
        try {
            startActivityForResult(call, intent, "upiPayResult");
        } catch (ActivityNotFoundException e) {
            if (pkg != null && !pkg.trim().isEmpty()) {
                try {
                    startActivityForResult(call, payIntent(uri.trim(), ""), "upiPayResult");
                    return;
                } catch (ActivityNotFoundException ignored) {
                    /* fall through */
                }
            }
            JSObject out = new JSObject();
            out.put("ok", false);
            out.put("outcome", "failed");
            out.put("status", "NO_UPI_APP");
            out.put("message", "No UPI app available to handle this payment");
            call.resolve(out);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "Could not open UPI app");
        }
    }

    private static Intent payIntent(String uri, String pkg) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(uri));
        intent.addCategory(Intent.CATEGORY_DEFAULT);
        if (pkg != null && !pkg.trim().isEmpty()) {
            intent.setPackage(pkg.trim());
        }
        return intent;
    }

    @ActivityCallback
    private void upiPayResult(PluginCall call, ActivityResult result) {
        JSObject out = new JSObject();
        int code = result.getResultCode();
        out.put("resultCode", code);
        Intent data = result.getData();
        String status = null;
        String response = null;
        String txnRef = null;
        String approvalRef = null;
        String txnId = null;
        boolean hasExtras = false;
        if (data != null) {
            status = firstExtra(data, "Status", "status", "STATUS");
            response = firstExtra(data, "responseCode", "ResponseCode", "response", "StatusCode");
            txnRef = firstExtra(data, "txnRef", "TxnRef", "tr");
            approvalRef = firstExtra(data, "ApprovalRefNo", "approvalRefNo", "txnId", "TxnId");
            txnId = firstExtra(data, "txnId", "TxnId", "transactionId");
            Bundle extras = data.getExtras();
            if (extras != null && extras.size() > 0) {
                hasExtras = true;
                JSObject raw = new JSObject();
                for (String key : extras.keySet()) {
                    Object val = extras.get(key);
                    if (val == null) continue;
                    String s = String.valueOf(val);
                    if (key.toLowerCase().contains("pin")) continue;
                    raw.put(key, s);
                    if (s.contains("=") && (s.contains("&") || s.contains("Status") || s.contains("txnId"))) {
                        applyBlob(s, out);
                        if (status == null) status = pickFromBlob(s, "Status", "status", "STATUS");
                        if (response == null) response = pickFromBlob(s, "responseCode", "ResponseCode", "StatusCode");
                        if (txnRef == null) txnRef = pickFromBlob(s, "txnRef", "TxnRef", "tr");
                        if (approvalRef == null) approvalRef = pickFromBlob(s, "ApprovalRefNo", "approvalRefNo");
                        if (txnId == null) txnId = pickFromBlob(s, "txnId", "TxnId", "transactionId");
                    }
                }
                out.put("raw", raw);
            }
        }
        if (status != null) out.put("status", status);
        if (response != null) out.put("responseCode", response);
        if (txnRef != null) out.put("txnRef", txnRef);
        if (approvalRef != null) out.put("approvalRefNo", approvalRef);
        if (txnId != null) out.put("txnId", txnId);

        String outcome = classify(status, response, code, hasExtras);
        out.put("outcome", outcome);
        out.put("ok", "success".equals(outcome));
        if (call != null) {
            call.resolve(out);
        }
    }

    private static void applyBlob(String blob, JSObject out) {
        if (out.has("responseBlob")) return;
        out.put("responseBlob", blob);
    }

    private static String pickFromBlob(String blob, String... keys) {
        String[] parts = blob.split("&");
        for (String part : parts) {
            int eq = part.indexOf('=');
            if (eq < 1) continue;
            String k = part.substring(0, eq).trim();
            String v = part.substring(eq + 1).trim();
            for (String want : keys) {
                if (want.equalsIgnoreCase(k) && !v.isEmpty()) return v;
            }
        }
        return null;
    }

    private static String firstExtra(Intent data, String... keys) {
        for (String key : keys) {
            String v = data.getStringExtra(key);
            if (v != null && !v.trim().isEmpty()) return v.trim();
        }
        return null;
    }

    private static String classify(String status, String responseCode, int resultCode, boolean hasExtras) {
        String s = status == null ? "" : status.trim().toUpperCase();
        String rc = responseCode == null ? "" : responseCode.trim().toUpperCase();
        if (rc.contains("RESPONSECODE=00") || rc.contains("STATUS=SUCCESS")) return "success";
        if (s.contains("SUCCESS") || "00".equals(rc) || "0".equals(rc)) return "success";
        if (s.contains("FAIL") || s.contains("FAILURE") || "01".equals(rc)) return "failed";
        if (s.contains("SUBMIT")) return "submitted";
        if (s.contains("CANCEL")) return "cancelled";
        // PhonePe often returns RESULT_CANCELED with empty extras after a real debit.
        // Treat that as unknown so the user can record the payment — never as a hard cancel.
        if (resultCode == Activity.RESULT_CANCELED && !hasExtras) return "unknown";
        if (!hasExtras && resultCode != Activity.RESULT_OK) return "unknown";
        return "unknown";
    }
}
