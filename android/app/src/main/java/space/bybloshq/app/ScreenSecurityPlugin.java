package space.bybloshq.app;

import android.app.Activity;
import android.util.Log;
import android.view.WindowManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ScreenSecurityPlugin provides dynamic toggling of Android's WindowManager.LayoutParams.FLAG_SECURE.
 *
 * This allows public areas (Storefront, Marketplace, Receipts, Order Tracking) to be screenshotted
 * and shared freely by buyers and sellers, while dynamically securing sensitive views
 * (such as high-res product art previews, admin backoffice panels, and payment/checkout forms).
 */
@CapacitorPlugin(name = "ScreenSecurity")
public class ScreenSecurityPlugin extends Plugin {
    private static final String TAG = "ScreenSecurityPlugin";

    @PluginMethod
    public void enable(PluginCall call) {
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                try {
                    activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    Log.d(TAG, "FLAG_SECURE enabled");
                    JSObject ret = new JSObject();
                    ret.put("secured", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    Log.e(TAG, "Error enabling FLAG_SECURE", e);
                    call.reject("Failed to enable screen security: " + e.getMessage());
                }
            });
        } else {
            call.reject("Activity is null");
        }
    }

    @PluginMethod
    public void disable(PluginCall call) {
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                try {
                    activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    Log.d(TAG, "FLAG_SECURE disabled");
                    JSObject ret = new JSObject();
                    ret.put("secured", false);
                    call.resolve(ret);
                } catch (Exception e) {
                    Log.e(TAG, "Error disabling FLAG_SECURE", e);
                    call.reject("Failed to disable screen security: " + e.getMessage());
                }
            });
        } else {
            call.reject("Activity is null");
        }
    }

    @PluginMethod
    public void setSecure(PluginCall call) {
        Boolean secure = call.getBoolean("secure", true);
        Activity activity = getActivity();
        if (activity != null) {
            activity.runOnUiThread(() -> {
                try {
                    if (Boolean.TRUE.equals(secure)) {
                        activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                        Log.d(TAG, "FLAG_SECURE set to true");
                    } else {
                        activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                        Log.d(TAG, "FLAG_SECURE set to false");
                    }
                    JSObject ret = new JSObject();
                    ret.put("secured", secure);
                    call.resolve(ret);
                } catch (Exception e) {
                    Log.e(TAG, "Error setting FLAG_SECURE", e);
                    call.reject("Failed to set screen security: " + e.getMessage());
                }
            });
        } else {
            call.reject("Activity is null");
        }
    }
}
