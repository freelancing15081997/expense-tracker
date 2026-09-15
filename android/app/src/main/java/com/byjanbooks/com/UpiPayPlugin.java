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
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setData(Uri.parse(uri.trim()));
        intent.addCategory(Intent.CATEGORY_DEFAULT);
        try {
            startActivityForResult(call, intent, "upiPayResult");
        } catch (ActivityNotFoundException e) {
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

    @ActivityCallback
    private void upiPayResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject out = new JSObject();
        int code = result.getResultCode();
        out.put("resultCode", code);
        Intent data = result.getData();
        String status = null;
        String response = null;
        String txnRef = null;
        String approvalRef = null;
        String txnId = null;
        if (data != null) {
            status = firstExtra(data, "Status", "status", "STATUS");
            response = firstExtra(data, "responseCode", "ResponseCode", "response", "StatusCode");
            txnRef = firstExtra(data, "txnRef", "TxnRef", "tr");
            approvalRef = firstExtra(data, "ApprovalRefNo", "approvalRefNo", "txnId", "TxnId");
            txnId = firstExtra(data, "txnId", "TxnId", "transactionId");
            Bundle extras = data.getExtras();
            if (extras != null) {
                JSObject raw = new JSObject();
                for (String key : extras.keySet()) {
                    Object val = extras.get(key);
                    if (val == null) continue;
                    String s = String.valueOf(val);
                    // Never forward anything that looks like a PIN.
                    if (key.toLowerCase().contains("pin")) continue;
                    raw.put(key, s);
                }
                out.put("raw", raw);
            }
        }
        if (status != null) out.put("status", status);
        if (response != null) out.put("responseCode", response);
        if (txnRef != null) out.put("txnRef", txnRef);
        if (approvalRef != null) out.put("approvalRefNo", approvalRef);
        if (txnId != null) out.put("txnId", txnId);

        String outcome = classify(status, response, code, data != null);
        out.put("outcome", outcome);
        out.put("ok", "success".equals(outcome));
        call.resolve(out);
    }

    private static String firstExtra(Intent data, String... keys) {
        for (String key : keys) {
            String v = data.getStringExtra(key);
            if (v != null && !v.trim().isEmpty()) return v.trim();
        }
        return null;
    }

    private static String classify(String status, String responseCode, int resultCode, boolean hasData) {
        String s = status == null ? "" : status.trim().toUpperCase();
        String rc = responseCode == null ? "" : responseCode.trim().toUpperCase();
        if (s.contains("SUCCESS") || "00".equals(rc) || "0".equals(rc)) return "success";
        if (s.contains("FAIL") || s.contains("FAILURE") || "01".equals(rc)) return "failed";
        if (s.contains("SUBMIT")) return "submitted";
        if (resultCode == Activity.RESULT_CANCELED && !hasData) return "cancelled";
        if (s.contains("CANCEL")) return "cancelled";
        if (!hasData && resultCode != Activity.RESULT_OK) return "cancelled";
        return "unknown";
    }
}
