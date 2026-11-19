package app.vexis;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.MimeTypeMap;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Vexis — приложение. Интерфейс (index.html), звуки/анимации (res/) и картинки подарков (gifts/) лежат ВНУТРИ APK
 * и открываются локально. На сервер (Render) уходят только запросы к API и недостающие файлы.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ORIGIN = "https://" + HOST;
    private static final int REQ_FILE = 1, REQ_PERM = 2;

    private WebView web;
    private ValueCallback<Uri[]> fileCb;
    private PermissionRequest pendingPerm;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().setStatusBarColor(0xFF17212B);
        getWindow().setNavigationBarColor(0xFF17212B);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return handle(r);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView w, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (fileCb != null) fileCb.onReceiveValue(null);
                fileCb = cb;
                try {
                    startActivityForResult(p.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCb = null;
                    return false;
                }
                return true;
            }

            @Override
            public void onPermissionRequest(final PermissionRequest req) {
                runOnUiThread(() -> askPermission(req));
            }
        });

        web.loadUrl(ORIGIN + "/index.html");

        // Free Render засыпает — будим сервер заранее, пока пользователь смотрит на интерфейс.
        new Thread(() -> {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(BuildConfig.SERVER_URL + "/ping").openConnection();
                c.setConnectTimeout(60000);
                c.setReadTimeout(60000);
                c.getResponseCode();
                c.disconnect();
            } catch (Exception ignored) { }
        }).start();
    }

    // ───── запросы WebView: локальные файлы приложения, остальное — на сервер ─────
    private WebResourceResponse handle(WebResourceRequest r) {
        Uri u = r.getUrl();
        if (!HOST.equals(u.getHost())) return null;
        String path = u.getPath() == null ? "/" : u.getPath();
        if (path.equals("/") || path.equals("/index.html")) {
            WebResourceResponse x = asset("index.html");
            return x != null ? x : notFound();
        }
        if (path.startsWith("/res/") || path.startsWith("/gifts/")) {
            WebResourceResponse x = asset(path.substring(1));
            if (x != null) return x;
        }
        if ("GET".equalsIgnoreCase(r.getMethod())) return proxy(u, r.getRequestHeaders());
        return notFound();
    }

    private WebResourceResponse asset(String name) {
        try {
            InputStream in = getAssets().open(name);
            String ext = MimeTypeMap.getFileExtensionFromUrl(name.replace(" ", "_"));
            String mime = "text/html";
            if (!name.equals("index.html")) {
                mime = ext == null ? null : MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext.toLowerCase());
                if ("json".equals(ext)) mime = "application/json";
                if (mime == null) mime = "application/octet-stream";
            }
            WebResourceResponse resp = new WebResourceResponse(mime, "UTF-8", in);
            Map<String, String> h = new HashMap<>();
            h.put("Access-Control-Allow-Origin", "*");
            resp.setResponseHeaders(h);
            return resp;
        } catch (IOException e) {
            return null;
        }
    }

    private WebResourceResponse proxy(Uri u, Map<String, String> reqHeaders) {
        try {
            String q = u.getEncodedQuery();
            URL url = new URL(BuildConfig.SERVER_URL + u.getEncodedPath() + (q != null ? "?" + q : ""));
            HttpURLConnection c = (HttpURLConnection) url.openConnection();
            c.setConnectTimeout(30000);
            c.setReadTimeout(90000);
            c.setRequestProperty("User-Agent", "VexisApp/Android");
            String range = reqHeaders == null ? null : reqHeaders.get("Range");
            if (range != null) c.setRequestProperty("Range", range);
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) in = new ByteArrayInputStream(new byte[0]);
            String ct = c.getContentType() == null ? "application/octet-stream" : c.getContentType();
            String mime = ct.split(";")[0].trim();
            Map<String, String> h = new HashMap<>();
            h.put("Access-Control-Allow-Origin", "*");
            String cc = c.getHeaderField("Cache-Control");
            if (cc != null) h.put("Cache-Control", cc);
            String cr = c.getHeaderField("Content-Range");
            if (cr != null) h.put("Content-Range", cr);
            if (code < 200 || code > 599 || (code >= 300 && code < 400)) code = 502;
            return new WebResourceResponse(mime, "UTF-8", code, code < 400 ? "OK" : "Error", h, in);
        } catch (Exception e) {
            return notFound(502, "{\"error\":\"Нет связи с сервером\"}");
        }
    }

    private WebResourceResponse notFound() {
        return notFound(404, "{\"error\":\"Не найдено\"}");
    }

    private WebResourceResponse notFound(int code, String body) {
        try {
            Map<String, String> h = new HashMap<>();
            h.put("Access-Control-Allow-Origin", "*");
            return new WebResourceResponse("application/json", "UTF-8", code, "Error", h,
                    new ByteArrayInputStream(body.getBytes("UTF-8")));
        } catch (Exception e) {
            return null;
        }
    }

    // ───── микрофон / камера для веб-части ─────
    private void askPermission(PermissionRequest req) {
        if (req.getOrigin() == null || !req.getOrigin().toString().startsWith(ORIGIN)) {
            req.deny();
            return;
        }
        List<String> need = new ArrayList<>();
        for (String r : req.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) need.add(Manifest.permission.RECORD_AUDIO);
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) need.add(Manifest.permission.CAMERA);
        }
        List<String> missing = new ArrayList<>();
        for (String p : need) if (checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED) missing.add(p);
        if (missing.isEmpty()) {
            req.grant(req.getResources());
        } else {
            if (pendingPerm != null) pendingPerm.deny();
            pendingPerm = req;
            requestPermissions(missing.toArray(new String[0]), REQ_PERM);
        }
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] perms, int[] res) {
        super.onRequestPermissionsResult(code, perms, res);
        if (code != REQ_PERM || pendingPerm == null) return;
        boolean ok = res.length > 0;
        for (int r : res) if (r != PackageManager.PERMISSION_GRANTED) ok = false;
        if (ok) pendingPerm.grant(pendingPerm.getResources()); else pendingPerm.deny();
        pendingPerm = null;
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_FILE && fileCb != null) {
            fileCb.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res, data));
            fileCb = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack(); else moveTaskToBack(true);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }
}
