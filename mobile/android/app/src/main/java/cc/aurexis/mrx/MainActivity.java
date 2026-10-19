package cc.aurexis.mrx;

import android.os.Bundle;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Logger;
import java.lang.reflect.Method;
import java.util.Collections;

public class MainActivity extends BridgeActivity {

    /** The app's own bundled pages: the offline screen and the downloads library. */
    private static final String LOCAL_ORIGIN = "https://localhost";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        exposeBridgeToLocalPages();
    }

    /**
     * The app loads the live site, so Capacitor only injects its bridge there.
     * The offline screen and the downloads library are bundled pages served
     * from https://localhost; they need the bridge too (to list and play the
     * lessons saved on the phone). The bridge already accepts messages from
     * that origin, it just does not inject the script into it, so do that here.
     * Capacitor keeps the script builder private, hence the reflection; the
     * version is pinned in mobile/package.json, and a failure only means the
     * library falls back to "try again".
     */
    private void exposeBridgeToLocalPages() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return;
        try {
            Method getInjector = Bridge.class.getDeclaredMethod("getJSInjector");
            getInjector.setAccessible(true);
            Object injector = getInjector.invoke(bridge);
            if (injector == null) return;
            Method getScript = injector.getClass().getDeclaredMethod("getScriptString");
            getScript.setAccessible(true);
            String script = (String) getScript.invoke(injector);
            WebViewCompat.addDocumentStartJavaScript(bridge.getWebView(), script, Collections.singleton(LOCAL_ORIGIN));
        } catch (Exception error) {
            Logger.error("Could not expose the bridge to local pages", error);
        }
    }
}
