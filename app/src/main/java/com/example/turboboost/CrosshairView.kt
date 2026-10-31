package com.example.turboboost

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.view.View
import kotlin.math.min

/**
 * Прицел поверх игры — детальные параметры как в StandVisuals.
 * length / thickness / gap / alpha / outline / scale + отдельные стороны.
 */
class CrosshairView(context: Context) : View(context) {

    var style = 1
    var colorIndex = 2
    var sizeStep = 3
    var opacity = 100
    var outline = true
    var gap = 2
    var offsetXDp = 0
    var offsetYDp = 0

    // detailed (StandVisuals-style)
    var lengthPx = 20f
    var thicknessPx = 3f
    var gapPx = 6f
    var alphaF = 1f
    var outlineW = 1f
    var scale = 1f
    var lineTop = true
    var lineBot = true
    var lineLeft = true
    var lineRight = true

    companion object {
        val PALETTE: IntArray = intArrayOf(
            0xFFFFFFFF.toInt(), 0xFFB0B0B0.toInt(), 0xFFFF2D2D.toInt(), 0xFFFF4D6A.toInt(),
            0xFFFF6B2D.toInt(), 0xFFFF8C00.toInt(),
            0xFFFFB020.toInt(), 0xFFFFD400.toInt(), 0xFFFFFF00.toInt(), 0xFFB8FF3D.toInt(),
            0xFF4DFF4D.toInt(), 0xFF00E676.toInt(),
            0xFF69F0AE.toInt(), 0xFF00E5C0.toInt(), 0xFF00E5FF.toInt(), 0xFF00B0FF.toInt(),
            0xFF2979FF.toInt(), 0xFF448AFF.toInt(),
            0xFF536DFE.toInt(), 0xFF7C4DFF.toInt(), 0xFFB388FF.toInt(), 0xFFE040FB.toInt(),
            0xFFFF4081.toInt(), 0xFFFF80AB.toInt(), 0xFFFFEB3B.toInt()
        )
        val STYLE_NAMES = arrayOf(
            "Точка", "Крест", "Круг", "Крест+точка", "T-образный",
            "Скобки", "Ромб", "Плюс+точка", "Сердце", "Снайпер",
            "Крест+зазор", "Двойное кольцо"
        )
    }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val outlinePaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val path = Path()

    private fun px(v: Float) = v * resources.displayMetrics.density

    fun applyFrom(prefs: AppPrefs) {
        style = prefs.getCrosshairStyle()
        colorIndex = prefs.getCrosshairColor().coerceIn(0, PALETTE.lastIndex)
        sizeStep = prefs.getCrosshairSize().coerceIn(1, 5)
        opacity = prefs.getCrosshairOpacity().coerceIn(10, 100)
        outline = prefs.isCrosshairOutline() && prefs.getCxOutlineW() > 0.05f
        gap = prefs.getCrosshairGap().coerceIn(0, 5)
        offsetXDp = prefs.getCrosshairOffsetX()
        offsetYDp = prefs.getCrosshairOffsetY()

        lengthPx = prefs.getCxLength()
        thicknessPx = prefs.getCxThickness()
        gapPx = prefs.getCxGapF()
        alphaF = prefs.getCxAlpha()
        outlineW = prefs.getCxOutlineW()
        scale = prefs.getCxScale()
        lineTop = prefs.isCxLineTop()
        lineBot = prefs.isCxLineBot()
        lineLeft = prefs.isCxLineLeft()
        lineRight = prefs.isCxLineRight()
        invalidate()
    }

    override fun onDraw(canvas: Canvas) {
        val cx = width / 2f + px(offsetXDp.toFloat())
        val cy = height / 2f + px(offsetYDp.toFloat())
        val s = scale.coerceIn(0.3f, 3f)
        val len = px(lengthPx) * s
        val thick = px(thicknessPx) * s
        val g = px(gapPx) * s
        val alpha = (alphaF.coerceIn(0.05f, 1f) * 255f).toInt().coerceIn(12, 255)
        val baseColor = PALETTE[colorIndex.coerceIn(0, PALETTE.lastIndex)]
        val color = (baseColor and 0x00FFFFFF) or (alpha shl 24)

        paint.color = color
        paint.strokeWidth = thick.coerceAtLeast(1f)
        paint.style = Paint.Style.STROKE
        paint.strokeCap = Paint.Cap.ROUND
        paint.strokeJoin = Paint.Join.ROUND

        outlinePaint.set(paint)
        outlinePaint.color = (0xFF000000.toInt() and 0x00FFFFFF) or ((alpha * 0.55f).toInt().coerceIn(20, 180) shl 24)
        outlinePaint.strokeWidth = thick + px(outlineW.coerceAtLeast(0f))

        fun strokeLine(x1: Float, y1: Float, x2: Float, y2: Float) {
            if (outline && outlineW > 0.05f) canvas.drawLine(x1, y1, x2, y2, outlinePaint)
            canvas.drawLine(x1, y1, x2, y2, paint)
        }

        fun strokeCircle(r: Float) {
            if (outline && outlineW > 0.05f) canvas.drawCircle(cx, cy, r, outlinePaint)
            canvas.drawCircle(cx, cy, r, paint)
        }

        fun fillDot(r: Float) {
            paint.style = Paint.Style.FILL
            if (outline && outlineW > 0.05f) {
                outlinePaint.style = Paint.Style.FILL
                canvas.drawCircle(cx, cy, r + px(0.8f), outlinePaint)
                outlinePaint.style = Paint.Style.STROKE
            }
            canvas.drawCircle(cx, cy, r, paint)
            paint.style = Paint.Style.STROKE
        }

        // detailed cross uses length/gap/sides
        fun drawCrossDetailed() {
            if (lineLeft) strokeLine(cx - g - len, cy, cx - g, cy)
            if (lineRight) strokeLine(cx + g, cy, cx + g + len, cy)
            if (lineTop) strokeLine(cx, cy - g - len, cx, cy - g)
            if (lineBot) strokeLine(cx, cy + g, cx, cy + g + len)
        }

        when (style.coerceIn(0, 11)) {
            0 -> fillDot(min(len * 0.25f, thick * 2f).coerceAtLeast(px(2f)))
            1 -> drawCrossDetailed()
            2 -> strokeCircle(len * 0.55f)
            3 -> {
                drawCrossDetailed()
                fillDot(thick * 0.9f)
            }
            4 -> {
                // T
                if (lineTop || lineBot) strokeLine(cx, cy - len, cx, cy + len * 0.35f)
                if (lineLeft || lineRight) strokeLine(cx - len * 0.85f, cy - len * 0.55f, cx + len * 0.85f, cy - len * 0.55f)
            }
            5 -> {
                val arm = len * 0.55f
                strokeLine(cx - len * 0.9f, cy - arm, cx - len * 0.9f, cy + arm)
                strokeLine(cx - len * 0.9f, cy - arm, cx - len * 0.45f, cy - arm)
                strokeLine(cx - len * 0.9f, cy + arm, cx - len * 0.45f, cy + arm)
                strokeLine(cx + len * 0.9f, cy - arm, cx + len * 0.9f, cy + arm)
                strokeLine(cx + len * 0.9f, cy - arm, cx + len * 0.45f, cy - arm)
                strokeLine(cx + len * 0.9f, cy + arm, cx + len * 0.45f, cy + arm)
            }
            6 -> {
                path.reset()
                path.moveTo(cx, cy - len * 0.85f)
                path.lineTo(cx + len * 0.65f, cy)
                path.lineTo(cx, cy + len * 0.85f)
                path.lineTo(cx - len * 0.65f, cy)
                path.close()
                if (outline && outlineW > 0.05f) canvas.drawPath(path, outlinePaint)
                canvas.drawPath(path, paint)
            }
            7 -> {
                drawCrossDetailed()
                fillDot(thick * 0.7f)
            }
            8 -> {
                // heart-ish / check
                strokeLine(cx - len * 0.7f, cy, cx - len * 0.1f, cy + len * 0.6f)
                strokeLine(cx - len * 0.1f, cy + len * 0.6f, cx + len * 0.8f, cy - len * 0.65f)
            }
            9 -> {
                strokeCircle(len * 0.55f)
                drawCrossDetailed()
                fillDot(thick * 0.5f)
            }
            10 -> drawCrossDetailed()
            11 -> {
                strokeCircle(len * 0.4f)
                strokeCircle(len * 0.7f)
            }
        }
    }
}
