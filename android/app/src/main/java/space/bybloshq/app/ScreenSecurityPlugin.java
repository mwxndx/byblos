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

    private void applySecure(boolean secure, PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity is null");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                if (secure) {
                    activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                } else {
                    activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                }
                Log.d(TAG, "FLAG_SECURE set to " + secure);
                JSObject ret = new JSObject();
                ret.put("secured", secure);
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Error toggling FLAG_SECURE", e);
                call.reject("Failed to set screen security: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void enable(PluginCall call) {
        applySecure(true, call);
    }

    @PluginMethod
    public void disable(PluginCall call) {
        applySecure(false, call);
    }

    @PluginMethod
    public void setSecure(PluginCall call) {
        Boolean secure = call.getBoolean("secure", true);
        applySecure(Boolean.TRUE.equals(secure), call);
    }
}
