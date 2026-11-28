package br.com.gestaoculturalpro.calc

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.content.Intent
import android.graphics.Bitmap
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.graphics.Color
import androidx.core.view.WindowCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Atividade principal do GCP-Calc no Android.
 * - Ignora a escala de fonte do sistema (textZoom 100): a interface já é responsiva e
 *   o tamanho do texto é ajustado dentro do app (Configurações › Geral › Editor).
 * - Permissões (microfone, câmera e notificações): pedidas uma única vez, juntas, pela tela de
 *   boas-vindas do app; o estado real vem do Android (nada de pedidos repetidos ou simultâneos).
 * - Se o processo da WebView cair (ex.: falta de memória), reinicia o app em vez de fechar
 *   com "apresenta falhas continuamente".
 * - Desenha de ponta a ponta e informa ao CSS as áreas da barra de status, da barra de
 *   gestos, do entalhe e do teclado (--safe-t/-b/-l/-r e --kb), em pixels CSS.
 */
class MainActivity : TauriActivity() {
  private var webView: WebView? = null
  private var lastJs = ""
  @Volatile private var pending = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    @Suppress("DEPRECATION")
    window.statusBarColor = Color.TRANSPARENT
    @Suppress("DEPRECATION")
    window.navigationBarColor = Color.TRANSPARENT
    val root = findViewById<android.view.View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
      val d = resources.displayMetrics.density
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
      fun px(v: Int) = "${(v / d).toInt()}px"
      lastJs = "(function(s){s.setProperty('--safe-t','${px(bars.top)}');s.setProperty('--safe-b','${px(bars.bottom)}');" +
        "s.setProperty('--safe-l','${px(bars.left)}');s.setProperty('--safe-r','${px(bars.right)}');" +
        "s.setProperty('--kb','${px(maxOf(0, ime.bottom - bars.bottom))}');" +
        "document.documentElement.classList.toggle('kb-open',${ime.bottom > bars.bottom});" +
        "document.documentElement.classList.add('native-insets');})(document.documentElement.style)"
      push()
      insets
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView
    webView.settings.textZoom = 100
    // Tema claro/escuro do app → cor dos ícones da barra de status e de navegação.
    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun setLightBars(light: Boolean) {
        runOnUiThread {
          val c = WindowCompat.getInsetsController(window, window.decorView)
          c.isAppearanceLightStatusBars = light
          c.isAppearanceLightNavigationBars = light
        }
      }
      /** "granted" | "denied" para "mic" ou "notify" */
      @JavascriptInterface
      fun permission(name: String): String = if (isGranted(permFor(name))) "granted" else "denied"
      @JavascriptInterface
      fun requestPermissions() {
        runOnUiThread {
          val need = missing()
          if (need.isEmpty() || pending) return@runOnUiThread
          pending = true
          ActivityCompat.requestPermissions(this@MainActivity, need.toTypedArray(), 4710)
        }
      }
      /** a janela de permissões do sistema ainda está aberta? */
      @JavascriptInterface
      fun permissionsPending(): Boolean = pending
      @JavascriptInterface
      fun allGranted(): Boolean = missing().isEmpty()
    }, "GcpNative")
    // Cliente da WebView do Tauri com proteção contra queda do processo de renderização.
    webView.post { guardRenderer(webView) }
    // A página carrega depois da criação da WebView: reaplica algumas vezes.
    for (delay in longArrayOf(400, 1500, 4000)) webView.postDelayed({ push() }, delay)
  }

  /** Envolve o cliente do Tauri (tudo é repassado a ele) e trata a queda da WebView. */
  private fun guardRenderer(wv: WebView) {
    if (Build.VERSION.SDK_INT < 26) return
    val orig = wv.webViewClient
    if (orig.javaClass.name.endsWith("GuardedClient")) return
    wv.webViewClient = object : WebViewClient() {
      override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = orig.shouldInterceptRequest(view, request)
      override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean = orig.shouldOverrideUrlLoading(view, request)
      override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) = orig.onPageStarted(view, url, favicon)
      override fun onPageFinished(view: WebView, url: String) = orig.onPageFinished(view, url)
      override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) = orig.doUpdateVisitedHistory(view, url, isReload)
      override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) = orig.onReceivedError(view, request, error)
      override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
        // as notas já foram salvas no disco; abre o app de novo, limpo
        packageManager.getLaunchIntentForPackage(packageName)?.let {
          it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
          startActivity(it)
        }
        finishAffinity()
        Runtime.getRuntime().exit(0)
        return true
      }
    }
  }

  private fun wanted(): List<String> {
    val list = mutableListOf(Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA)
    if (Build.VERSION.SDK_INT >= 33) list.add(Manifest.permission.POST_NOTIFICATIONS)
    return list
  }

  private fun isGranted(p: String?) = p == null || ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

  private fun permFor(name: String): String? = when (name) {
    "mic" -> Manifest.permission.RECORD_AUDIO
    "camera" -> Manifest.permission.CAMERA
    "notify" -> if (Build.VERSION.SDK_INT >= 33) Manifest.permission.POST_NOTIFICATIONS else null
    else -> null
  }

  private fun missing() = wanted().filter { !isGranted(it) }

  override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode == 4710) pending = false
  }

  private fun push() {
    val wv = webView ?: return
    if (lastJs.isNotEmpty()) wv.post { wv.evaluateJavascript(lastJs, null) }
  }
}
