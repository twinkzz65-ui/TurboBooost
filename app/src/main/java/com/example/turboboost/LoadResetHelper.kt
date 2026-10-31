package com.example.turboboost

import android.content.Context
import android.os.Handler
import android.os.Looper
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Автосброс разрешения после загрузки игры (логика StandVisuals-style).
 *
 * Режимы подтверждения 100%:
 * 1) Явный вызов confirmLoad100() из UI/оверлея
 * 2) Таймер аварийной защиты (90 с) после apply stretch
 *
 * Когда 100% подтверждены два раза подряд → ждём +5 с → resetDisplay().
 */
object LoadResetHelper {

    private val main = Handler(Looper.getMainLooper())
    private val armed = AtomicBoolean(false)
    private val confirms = AtomicInteger(0)
    private var emergencyRunnable: Runnable? = null
    private var resetRunnable: Runnable? = null
    private var lastResult = "IDLE"
    private var lastMethod = "—"
    private var startedAt = 0L

    fun status(): Map<String, String> = mapOf(
        "RESULT" to lastResult,
        "METHOD" to lastMethod,
        "ELAPSED" to if (startedAt == 0L) "—" else "${(System.currentTimeMillis() - startedAt) / 1000}s",
        "CONFIRMS" to confirms.get().toString(),
        "ARMED" to armed.get().toString()
    )

    /** Вызвать после applyDisplay (временный растяг). */
    fun arm(ctx: Context, emergencySec: Long = 90L) {
        cancel()
        armed.set(true)
        confirms.set(0)
        startedAt = System.currentTimeMillis()
        lastResult = "ARMED"
        lastMethod = "WAIT_100"
        val r = Runnable {
            if (armed.get()) {
                lastResult = "EMERGENCY_RESET"
                lastMethod = "TIMEOUT_${emergencySec}s"
                try { DeviceInfo(ctx).resetDisplay() } catch (_: Throwable) {}
                AppPrefs(ctx).setDisplayTweaked(false)
                armed.set(false)
            }
        }
        emergencyRunnable = r
        main.postDelayed(r, emergencySec * 1000L)
    }

    /** Подтверждение 100% (два раза подряд). */
    fun confirmLoad100(ctx: Context, delayAfterSec: Long = 5L) {
        if (!armed.get()) {
            lastResult = "NOT_ARMED"
            return
        }
        val n = confirms.incrementAndGet()
        lastMethod = "MANUAL_CONFIRM"
        if (n >= 2) {
            lastResult = "CONFIRMED_PENDING_RESET"
            val r = Runnable {
                if (armed.get()) {
                    lastResult = "RESET_DONE"
                    try { DeviceInfo(ctx).resetDisplay() } catch (_: Throwable) {}
                    AppPrefs(ctx).setDisplayTweaked(false)
                    armed.set(false)
                    confirms.set(0)
                }
            }
            resetRunnable = r
            main.postDelayed(r, delayAfterSec * 1000L)
        } else {
            lastResult = "NEED_SECOND_CONFIRM"
        }
    }

    fun cancel() {
        emergencyRunnable?.let { main.removeCallbacks(it) }
        resetRunnable?.let { main.removeCallbacks(it) }
        emergencyRunnable = null
        resetRunnable = null
        armed.set(false)
        confirms.set(0)
        lastResult = "IDLE"
        lastMethod = "—"
        startedAt = 0L
    }
}
