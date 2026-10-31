package com.example.turboboost

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.*
import android.widget.LinearLayout.LayoutParams.MATCH_PARENT
import android.widget.LinearLayout.LayoutParams.WRAP_CONTENT

/**
 * Карточный UI в стиле StandVisuals + все функции TurboBoost.
 * Без лагов: тяжёлая работа только через callbacks (MainActivity/bg).
 */
class StandStyleUI(private val ctx: Context) {

    private val dens = ctx.resources.displayMetrics.density
    private fun dp(v: Int) = (v * dens).toInt()
    private fun dp(v: Float) = v * dens

    // palette
    private val bg = Color.parseColor("#0A0C10")
    private val card = Color.parseColor("#161A22")
    private val cardBorder = Color.parseColor("#222833")
    private val colText = Color.parseColor("#F2F4F8")
    private val muted = Color.parseColor("#8B93A7")
    private val accent = Color.parseColor("#3B82F6")
    private val accentSoft = Color.parseColor("#1E3A5F")
    private val danger = Color.parseColor("#EF4444")
    private val ok = Color.parseColor("#22C55E")

    lateinit var root: FrameLayout
    private lateinit var contentHost: FrameLayout
    private lateinit var bottomBar: LinearLayout
    private val pages = mutableMapOf<String, ScrollView>()
    private var currentTab = "turbo"

    // callbacks — MainActivity вешает реализацию
    var onApplyTurbo: (() -> Unit)? = null
    var onRevertAll: (() -> Unit)? = null
    var onApplyStretch: ((enabled: Boolean, stretch: Int, tablet: Boolean) -> Unit)? = null
    var onTestStretch: (() -> Unit)? = null
    var onResetDisplay: (() -> Unit)? = null
    var onLoadReduce: ((level: Int) -> Unit)? = null
    var onRefreshDevice: (() -> Unit)? = null
    var onOpenShizuku: (() -> Unit)? = null
    var onRequestShizuku: (() -> Unit)? = null
    var onRequestUsage: (() -> Unit)? = null
    var onRequestOverlay: (() -> Unit)? = null
    var onCheckMaxHz: (() -> Unit)? = null
    var onRestoreHz: (() -> Unit)? = null
    var onCrosshairChanged: (() -> Unit)? = null
    var onComfortChanged: (() -> Unit)? = null
    var onOverlayToggles: (() -> Unit)? = null
    var onSettings: (() -> Unit)? = null
    var onPkgChanged: ((String) -> Unit)? = null
    var onSense: ((Int) -> Unit)? = null
    var onHz: ((Int) -> Unit)? = null
    var onGpu: ((Boolean) -> Unit)? = null
    var onPerfMode: ((Int) -> Unit)? = null
    var onDiagRefresh: (() -> Unit)? = null
    var onCopyCxCode: (() -> Unit)? = null
    var onPasteCxCode: (() -> Unit)? = null
    var onResetCx: (() -> Unit)? = null
    var onOpenLauncher: (() -> Unit)? = null

    // live status fields
    var statusText: TextView? = null
    var deviceStatusBox: LinearLayout? = null
    var diagBox: LinearLayout? = null
    var stretchPreviewLabel: TextView? = null
    var crossPreview: CrosshairView? = null
    var pkgInput: EditText? = null

    private val main = Handler(Looper.getMainLooper())

    fun build(): FrameLayout {
        root = FrameLayout(ctx).apply { setBackgroundColor(bg) }
        contentHost = FrameLayout(ctx)
        root.addView(contentHost, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT).apply {
            bottomMargin = dp(64)
        })
        bottomBar = buildBottomNav()
        root.addView(bottomBar, FrameLayout.LayoutParams(MATCH_PARENT, dp(64), Gravity.BOTTOM))

        pages["turbo"] = scrollOf(buildTurboPage())
        pages["stretch"] = scrollOf(buildStretchPage())
        pages["cross"] = scrollOf(buildCrossPage())
        pages["comfort"] = scrollOf(buildComfortPage())
        pages["diag"] = scrollOf(buildDiagPage())
        pages["settings"] = scrollOf(buildSettingsPage())

        showTab("turbo")
        return root
    }

    private fun scrollOf(page: LinearLayout): ScrollView =
        ScrollView(ctx).apply {
            isFillViewport = true
            setBackgroundColor(Color.TRANSPARENT)
            overScrollMode = View.OVER_SCROLL_NEVER
            addView(page, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT))
        }

    private fun showTab(id: String) {
        currentTab = id
        contentHost.removeAllViews()
        val sc = pages[id] ?: return
        contentHost.addView(sc, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
        // highlight bottom
        for (i in 0 until bottomBar.childCount) {
            val chip = bottomBar.getChildAt(i) as TextView
            val selected = chip.tag == id
            chip.setTextColor(if (selected) accent else muted)
            chip.setBackgroundColor(if (selected) accentSoft else Color.TRANSPARENT)
        }
    }

    private fun buildBottomNav(): LinearLayout {
        val bar = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(Color.parseColor("#12151C"))
            setPadding(dp(4), dp(6), dp(4), dp(6))
            elevation = dp(8).toFloat()
        }
        fun tab(id: String, label: String) {
            val t = TextView(ctx).apply {
                text = label
                tag = id
                gravity = Gravity.CENTER
                textSize = 11f
                setTextColor(muted)
                setPadding(0, dp(8), 0, dp(8))
                setOnClickListener { showTab(id) }
            }
            bar.addView(t, LinearLayout.LayoutParams(0, MATCH_PARENT, 1f).apply {
                marginStart = dp(2); marginEnd = dp(2)
            })
        }
        tab("turbo", "Турбо")
        tab("stretch", "Растяг")
        tab("cross", "Прицел")
        tab("comfort", "Игра")
        tab("diag", "Диагн.")
        tab("settings", "Ещё")
        return bar
    }

    // ---------- helpers ----------
    private fun page(): LinearLayout = LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        setPadding(dp(14), dp(18), dp(14), dp(28))
    }

    private fun title(t: String, sub: String = ""): LinearLayout {
        val box = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        box.addView(TextView(ctx).apply {
            this.text = t; textSize = 22f; setTextColor(colText); setTypeface(android.graphics.Typeface.DEFAULT_BOLD)
        })
        if (sub.isNotBlank()) box.addView(TextView(ctx).apply {
            text = sub; textSize = 12f; setTextColor(muted)
            setPadding(0, dp(4), 0, 0)
        })
        return box
    }

    private fun cardBox(): LinearLayout = LinearLayout(ctx).apply {
        orientation = LinearLayout.VERTICAL
        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(16).toFloat()
            setColor(card)
            setStroke(dp(1), cardBorder)
        }
        setPadding(dp(14), dp(14), dp(14), dp(14))
    }

    private fun cardLp(top: Int = 12) = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
        topMargin = dp(top)
    }

    private fun lbl(t: String, size: Float = 13f, c: Int = colText) = TextView(ctx).apply {
        text = t; textSize = size; setTextColor(c)
    }

    private fun mutedLbl(t: String) = lbl(t, 12f, muted)

    private fun primaryBtn(t: String, onClick: () -> Unit): TextView = TextView(ctx).apply {
        this.text = t; textSize = 14f; gravity = Gravity.CENTER; setTextColor(Color.WHITE)
        setTypeface(android.graphics.Typeface.DEFAULT_BOLD)
        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(14).toFloat()
            setColor(accent)
        }
        setPadding(dp(16), dp(14), dp(16), dp(14))
        setOnClickListener { onClick() }
    }

    private fun secondaryBtn(t: String, onClick: () -> Unit): TextView = TextView(ctx).apply {
        text = t; textSize = 13f; gravity = Gravity.CENTER; setTextColor(accent)
        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(14).toFloat()
            setColor(Color.parseColor("#1A2230"))
            setStroke(dp(1), accentSoft)
        }
        setPadding(dp(14), dp(12), dp(14), dp(12))
        setOnClickListener { onClick() }
    }

    private fun switchRow(title: String, desc: String, get: () -> Boolean, set: (Boolean) -> Unit): LinearLayout {
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(8), 0, dp(8))
        }
        val col = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        col.addView(lbl(title, 14f))
        if (desc.isNotBlank()) col.addView(mutedLbl(desc))
        row.addView(col, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        val sw = Switch(ctx).apply {
            isChecked = get()
            setOnCheckedChangeListener { _, v -> set(v) }
        }
        try {
            // accent when on (API dependent, ignore if fails)
            if (android.os.Build.VERSION.SDK_INT >= 23) {
                // no-op, system handles
            }
        } catch (_: Throwable) {}
        row.addView(sw)
        return row
    }

    private fun segment(options: List<String>, selected: Int, onSel: (Int) -> Unit): LinearLayout {
        val row = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL }
        options.forEachIndexed { i, name ->
            val tv = TextView(ctx).apply {
                text = name; gravity = Gravity.CENTER; textSize = 12f
                setPadding(dp(8), dp(10), dp(8), dp(10))
                setTextColor(if (i == selected) Color.WHITE else muted)
                background = GradientDrawable().apply {
                    shape = GradientDrawable.RECTANGLE
                    cornerRadius = dp(12).toFloat()
                    setColor(if (i == selected) accent else Color.parseColor("#1A1F2A"))
                }
                setOnClickListener {
                    for (j in 0 until row.childCount) {
                        val c = row.getChildAt(j) as TextView
                        c.setTextColor(if (j == i) Color.WHITE else muted)
                        (c.background as GradientDrawable).setColor(
                            if (j == i) accent else Color.parseColor("#1A1F2A")
                        )
                    }
                    onSel(i)
                }
            }
            row.addView(tv, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply {
                marginEnd = if (i < options.lastIndex) dp(6) else 0
            })
        }
        return row
    }

    private fun stepperF(title: String, value: () -> String, onMinus: () -> Unit, onPlus: () -> Unit): LinearLayout {
        val box = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL; setPadding(0, dp(6), 0, dp(6)) }
        val head = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL }
        head.addView(lbl(title, 12f, muted), LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f))
        val valTv = lbl(value(), 13f, accent)
        head.addView(valTv)
        box.addView(head)
        val row = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL; gravity = Gravity.CENTER_VERTICAL }
        fun side(sym: String, act: () -> Unit) = TextView(ctx).apply {
            text = sym; gravity = Gravity.CENTER; textSize = 18f; setTextColor(colText)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE; cornerRadius = dp(12).toFloat()
                setColor(Color.parseColor("#1A1F2A"))
            }
            setPadding(dp(16), dp(8), dp(16), dp(8))
            setOnClickListener { act(); valTv.text = value() }
        }
        row.addView(side("−", onMinus))
        val mid = TextView(ctx).apply {
            text = value(); gravity = Gravity.CENTER; textSize = 15f; setTextColor(colText)
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE; cornerRadius = dp(12).toFloat()
                setColor(Color.parseColor("#0E1218")); setStroke(dp(1), cardBorder)
            }
            setPadding(dp(8), dp(10), dp(8), dp(10))
        }
        row.addView(mid, LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply {
            marginStart = dp(8); marginEnd = dp(8)
        })
        row.addView(side("+") {
            onPlus()
            mid.text = value()
            valTv.text = value()
        })
        // fix minus also updates mid
        (row.getChildAt(0) as TextView).setOnClickListener {
            onMinus(); mid.text = value(); valTv.text = value()
        }
        box.addView(row)
        return box
    }

    // ===================== PAGES =====================

    private fun buildTurboPage(): LinearLayout {
        val p = page()
        p.addView(title("TurboBoost 3.0", "Турбо · растяг · прицел · комфорт · диагностика"))

        // hero card
        val hero = cardBox()
        statusText = lbl("Готов к работе", 13f, muted)
        hero.addView(lbl("Статус", 12f, muted))
        hero.addView(statusText!!)
        hero.addView(primaryBtn("⚡ Включить турбо") { onApplyTurbo?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(12) }
        })
        hero.addView(secondaryBtn("Полный откат") { onRevertAll?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        hero.addView(secondaryBtn("Лаунчер игр") { onOpenLauncher?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        p.addView(hero, cardLp(10))

        // package
        val pkgCard = cardBox()
        pkgCard.addView(lbl("Пакет игры", 14f))
        pkgCard.addView(mutedLbl("Например com.axlebolt.standoff2"))
        pkgInput = EditText(ctx).apply {
            setTextColor(colText); setHintTextColor(muted)
            setBackgroundColor(Color.parseColor("#0E1218"))
            setPadding(dp(12), dp(10), dp(12), dp(10))
            textSize = 13f
            setSingleLine()
            addTextChangedListener(object : android.text.TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun onTextChanged(s: CharSequence?, a: Int, b: Int, c: Int) {}
                override fun afterTextChanged(s: android.text.Editable?) {
                    onPkgChanged?.invoke(s?.toString()?.trim() ?: "")
                }
            })
        }
        pkgCard.addView(pkgInput, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) })
        p.addView(pkgCard, cardLp())

        // perf mode
        val perf = cardBox()
        perf.addView(lbl("Режим производительности", 14f))
        perf.addView(mutedLbl("Баланс / Максимум — лимиты фона и phantom processes"))
        perf.addView(segment(listOf("Баланс", "Макс."), 0) { onPerfMode?.invoke(it) }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) }
        })
        p.addView(perf, cardLp())

        // hz
        val hz = cardBox()
        hz.addView(lbl("Целевая герцовка", 14f))
        hz.addView(segment(listOf("60", "90", "120", "144"), 2) {
            val v = listOf(60, 90, 120, 144)[it]
            onHz?.invoke(v)
        }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) }
        })
        p.addView(hz, cardLp())

        // sense
        val sense = cardBox()
        sense.addView(lbl("Сенса", 14f))
        sense.addView(mutedLbl("Системный pointer_speed + sampling rate"))
        sense.addView(segment(listOf("Средн.", "Сильн.", "Эксп.", "Макс."), 1) {
            onSense?.invoke(it)
        }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) }
        })
        p.addView(sense, cardLp())

        // gpu
        val gpu = cardBox()
        gpu.addView(switchRow("GPU Boost", "Adreno/Mali governors + policy", { false }) {
            onGpu?.invoke(it)
        })
        p.addView(gpu, cardLp())

        // load reduce (from screenshots)
        val load = cardBox()
        load.addView(lbl("Снижение нагрузки", 14f))
        load.addView(mutedLbl("Меньше пикселей → выше FPS. Если включён растяг — он имеет приоритет."))
        load.addView(segment(listOf("Без изм.", "Чётко", "Баланс", "Быстро", "Макс."), 0) {
            onLoadReduce?.invoke(it)
        }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) }
        })
        p.addView(load, cardLp())

        return p
    }

    private fun buildStretchPage(): LinearLayout {
        val p = page()
        p.addView(title("Растяг", "Обычный — на телефонах, усиленный — на планшетах"))

        val prefs = AppPrefs(ctx)
        val mainCard = cardBox()
        mainCard.addView(switchRow(
            "Растяг",
            "Временно меняет разрешение до запуска и возвращает после загрузки",
            { prefs.isStretchEnabled() }
        ) { v ->
            prefs.setStretchEnabled(v)
            onApplyStretch?.invoke(v, prefs.getStretch(), prefs.isTabletMode())
        })
        mainCard.addView(View(ctx).apply {
            setBackgroundColor(cardBorder)
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, dp(1)).apply {
                topMargin = dp(8); bottomMargin = dp(8)
            }
        })
        mainCard.addView(switchRow(
            "Режим планшета",
            "Оставляет только сильные профили: 4:3, 5:4 и 1:1. Выключение не отключает растяг на телефоне.",
            { prefs.isTabletMode() }
        ) { v ->
            prefs.setTabletMode(v)
            onApplyStretch?.invoke(prefs.isStretchEnabled(), prefs.getStretch(), v)
        })
        p.addView(mainCard, cardLp(10))

        val profiles = cardBox()
        profiles.addView(lbl("Сильные профили планшета", 14f))
        profiles.addView(mutedLbl("Планшетный режим специально начинается с 4:3 — слабые варианты убраны."))
        val stretchMap = listOf(2, 1, 3) // 4:3, 5:4, 1:1
        val labels = listOf("4:3", "5:4", "1:1")
        val cur = when (prefs.getStretch()) {
            2 -> 0; 1 -> 1; 3 -> 2; else -> 0
        }
        profiles.addView(segment(labels, cur) { idx ->
            val st = stretchMap[idx]
            prefs.setStretch(st)
            onApplyStretch?.invoke(prefs.isStretchEnabled(), st, prefs.isTabletMode())
            stretchPreviewLabel?.text = try {
                DeviceInfo(ctx).previewStretchSize(st, prefs.isTabletMode())
            } catch (_: Throwable) { "—" }
        }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(12) }
        })
        val info = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                cornerRadius = dp(12).toFloat()
                setColor(Color.parseColor("#0E1624"))
                setStroke(dp(1), accentSoft)
            }
            setPadding(dp(12), dp(10), dp(12), dp(10))
        }
        info.addView(lbl("Сильный — 4:3", 14f, accent))
        info.addView(mutedLbl("Выраженный горизонтальный растяг"))
        info.addView(lbl("Сильный", 11f, muted))
        profiles.addView(info, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(12) })
        p.addView(profiles, cardLp())

        val auto = cardBox()
        auto.addView(lbl("Автоматический сброс по 100%", 14f))
        auto.addView(mutedLbl("TurboBoost следит за нижней частью загрузочного экрана. Когда 100% подтверждены два раза подряд — ждёт ещё 5 секунд и возвращает исходное разрешение."))
        auto.addView(switchRow("Автосброс", "UI hierarchy + локальный OCR", { prefs.isAutoReset100() }) {
            prefs.setAutoReset100(it)
        })
        auto.addView(mutedLbl("После 100%: +5 секунд · Аварийная защита: 90 секунд"))
        p.addView(auto, cardLp())

        val preview = cardBox()
        preview.addView(lbl("Предпросмотр", 14f))
        val frame = FrameLayout(ctx).apply {
            background = GradientDrawable().apply {
                cornerRadius = dp(12).toFloat()
                setColor(Color.parseColor("#0B0E14"))
                setStroke(dp(2), accent)
            }
            minimumHeight = dp(140)
        }
        val phone = View(ctx).apply {
            background = GradientDrawable().apply {
                cornerRadius = dp(8).toFloat()
                setColor(Color.parseColor("#1A2740"))
            }
        }
        frame.addView(phone, FrameLayout.LayoutParams(dp(200), dp(110), Gravity.CENTER))
        preview.addView(frame, LinearLayout.LayoutParams(MATCH_PARENT, dp(160)).apply { topMargin = dp(8) })
        stretchPreviewLabel = lbl(
            try { DeviceInfo(ctx).previewStretchSize(prefs.getStretch().coerceAtLeast(2), true) } catch (_: Throwable) { "960×720" },
            13f, muted
        )
        preview.addView(lbl("Временное разрешение", 12f, muted).apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) }
        })
        preview.addView(stretchPreviewLabel!!)
        preview.addView(lbl("Профиль", 12f, muted))
        preview.addView(lbl("Сильный — 4:3", 13f, colText))
        preview.addView(mutedLbl("Игра не перезапускается. После 100% + 5 с возвращается системное разрешение."))
        preview.addView(primaryBtn("Тест на 3 секунды") { onTestStretch?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(12) }
        })
        preview.addView(secondaryBtn("Вернуть разрешение") { onResetDisplay?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        p.addView(preview, cardLp())

        return p
    }

    private fun buildCrossPage(): LinearLayout {
        val p = page()
        p.addView(title("Прицел", "Форма, цвет, линии и код для друга"))
        val prefs = AppPrefs(ctx)

        val shapes = cardBox()
        shapes.addView(lbl("Форма", 14f))
        val shapeNames = listOf("Крест", "T", "Точка", "Сердце", "Квадрат", "Круг")
        // map to existing style indices where possible
        val styleMap = listOf(1, 4, 0, 8, 6, 2)
        val curStyle = styleMap.indexOf(prefs.getCrosshairStyle()).let { if (it < 0) 0 else it }
        shapes.addView(segment(shapeNames, curStyle) { i ->
            prefs.setCrosshairStyle(styleMap[i])
            crossPreview?.applyFrom(prefs)
            onCrosshairChanged?.invoke()
        }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) }
        })
        p.addView(shapes, cardLp(10))

        val prev = cardBox()
        prev.addView(lbl("Предпросмотр", 14f))
        val box = FrameLayout(ctx).apply {
            background = GradientDrawable().apply {
                cornerRadius = dp(12).toFloat()
                setColor(Color.BLACK)
            }
            minimumHeight = dp(160)
        }
        crossPreview = CrosshairView(ctx).apply { applyFrom(prefs) }
        box.addView(crossPreview, FrameLayout.LayoutParams(MATCH_PARENT, dp(160)))
        prev.addView(box, LinearLayout.LayoutParams(MATCH_PARENT, dp(160)).apply { topMargin = dp(8) })
        p.addView(prev, cardLp())

        val colors = cardBox()
        colors.addView(lbl("Цвет", 14f))
        val grid = GridLayout(ctx).apply {
            columnCount = 6
            useDefaultMargins = true
        }
        CrosshairView.PALETTE.forEachIndexed { i, col ->
            val dot = View(ctx).apply {
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(col)
                    if (i == prefs.getCrosshairColor()) setStroke(dp(3), Color.WHITE)
                }
                setOnClickListener {
                    prefs.setCrosshairColor(i)
                    crossPreview?.applyFrom(prefs)
                    onCrosshairChanged?.invoke()
                    // refresh strokes
                    for (j in 0 until grid.childCount) {
                        val g = (grid.getChildAt(j).background as GradientDrawable)
                        if (j == i) g.setStroke(dp(3), Color.WHITE) else g.setStroke(0, Color.TRANSPARENT)
                    }
                }
            }
            val lp = GridLayout.LayoutParams().apply {
                width = dp(36); height = dp(36)
            }
            grid.addView(dot, lp)
        }
        colors.addView(grid, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) })
        p.addView(colors, cardLp())

        val lines = cardBox()
        lines.addView(lbl("Все линии сразу", 14f))
        lines.addView(mutedLbl("Одна настройка меняет все четыре стороны креста."))
        lines.addView(stepperF("Длина линий", { String.format("%.2f", prefs.getCxLength()) }, {
            prefs.setCxLength(prefs.getCxLength() - 1f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }, {
            prefs.setCxLength(prefs.getCxLength() + 1f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }))
        lines.addView(stepperF("Толщина линий", { String.format("%.2f", prefs.getCxThickness()) }, {
            prefs.setCxThickness(prefs.getCxThickness() - 0.5f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }, {
            prefs.setCxThickness(prefs.getCxThickness() + 0.5f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }))
        lines.addView(stepperF("Отступ от центра", { String.format("%.2f", prefs.getCxGapF()) }, {
            prefs.setCxGapF(prefs.getCxGapF() - 0.5f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }, {
            prefs.setCxGapF(prefs.getCxGapF() + 0.5f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }))
        lines.addView(stepperF("Прозрачность", { String.format("%.2f", prefs.getCxAlpha()) }, {
            prefs.setCxAlpha(prefs.getCxAlpha() - 0.05f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }, {
            prefs.setCxAlpha(prefs.getCxAlpha() + 0.05f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }))
        lines.addView(stepperF("Обводка", { String.format("%.2f", prefs.getCxOutlineW()) }, {
            prefs.setCxOutlineW(prefs.getCxOutlineW() - 0.25f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }, {
            prefs.setCxOutlineW(prefs.getCxOutlineW() + 0.25f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }))
        lines.addView(stepperF("Масштаб", { String.format("%.2f", prefs.getCxScale()) }, {
            prefs.setCxScale(prefs.getCxScale() - 0.05f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }, {
            prefs.setCxScale(prefs.getCxScale() + 0.05f); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        }))
        p.addView(lines, cardLp())

        val sides = cardBox()
        sides.addView(lbl("Точная настройка отдельных линий", 14f))
        sides.addView(switchRow("Верхняя линия", "Нажми, чтобы настроить линию", { prefs.isCxLineTop() }) {
            prefs.setCxLineTop(it); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        })
        sides.addView(switchRow("Нижняя линия", "Нажми, чтобы настроить линию", { prefs.isCxLineBot() }) {
            prefs.setCxLineBot(it); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        })
        sides.addView(switchRow("Левая линия", "Нажми, чтобы настроить линию", { prefs.isCxLineLeft() }) {
            prefs.setCxLineLeft(it); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        })
        sides.addView(switchRow("Правая линия", "Нажми, чтобы настроить линию", { prefs.isCxLineRight() }) {
            prefs.setCxLineRight(it); crossPreview?.applyFrom(prefs); onCrosshairChanged?.invoke()
        })
        p.addView(sides, cardLp())

        val code = cardBox()
        code.addView(lbl("Код прицела", 14f))
        code.addView(mutedLbl("Отправь этот код другу — он вставит его у себя и получит точно такой же прицел."))
        val codeTv = lbl(prefs.getCrosshairCode().ifBlank { "—" }, 12f, accent).apply {
            setPadding(dp(10), dp(10), dp(10), dp(10))
            background = GradientDrawable().apply {
                cornerRadius = dp(10).toFloat()
                setColor(Color.parseColor("#0E1218"))
                setStroke(dp(1), cardBorder)
            }
        }
        code.addView(codeTv, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) })
        val row = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(primaryBtn("Скопировать") { onCopyCxCode?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { marginEnd = dp(6) }
        })
        row.addView(secondaryBtn("Вставить код") { onPasteCxCode?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)
        })
        code.addView(row, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) })
        code.addView(secondaryBtn("Сбросить настройки прицела") { onResetCx?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        p.addView(code, cardLp())

        // overlay toggles for crosshair
        val ov = cardBox()
        ov.addView(lbl("Оверлей", 14f))
        ov.addView(switchRow("Прицел поверх игры", "Использует настройки этой вкладки", { prefs.isCrosshair() }) {
            prefs.setCrosshair(it); onOverlayToggles?.invoke()
        })
        ov.addView(switchRow("Плавающая кнопка редактора", "Быстрый доступ к позиции прицела во время игры", {
            prefs.isFeat("cx_float_editor", true)
        }) {
            prefs.setFeat("cx_float_editor", it); onOverlayToggles?.invoke()
        })
        p.addView(ov, cardLp())

        return p
    }

    private fun buildComfortPage(): LinearLayout {
        val p = page()
        p.addView(title("Игра", "Комфорт, оверлей, пинг, FPS и звуки"))
        val prefs = AppPrefs(ctx)

        val gear = cardBox()
        gear.addView(switchRow(
            "Кнопка настройки в игре",
            "Шестерёнка поверх игры. Нажал — меню: прицел, рамка Пинг+FPS и зона звуков.",
            { prefs.isFeat("in_game_gear", false) }
        ) {
            prefs.setFeat("in_game_gear", it); onOverlayToggles?.invoke()
        })
        p.addView(gear, cardLp(10))

        val comfort = cardBox()
        comfort.addView(lbl("Комфорт", 14f))
        comfort.addView(switchRow("Максимальная яркость", "Устанавливает ручную яркость на максимум", {
            prefs.isFeat("max_brightness", false)
        }) { prefs.setFeat("max_brightness", it); onComfortChanged?.invoke() })
        comfort.addView(switchRow("Автояркость", "Включает автоматический режим на время сессии", {
            prefs.isFeat("auto_brightness", false)
        }) { prefs.setFeat("auto_brightness", it); onComfortChanged?.invoke() })
        comfort.addView(switchRow("Не беспокоить", "Скрывает звонки и уведомления", {
            prefs.isFeat("dnd", false)
        }) { prefs.setFeat("dnd", it); onComfortChanged?.invoke() })
        comfort.addView(switchRow("Не выключать экран", "Увеличивает системный таймер на время игры", {
            prefs.isFeat("keep_screen", false)
        }) { prefs.setFeat("keep_screen", it); onComfortChanged?.invoke() })
        comfort.addView(switchRow("Вернуть настройки после игры", "Восстановить яркость, DND и таймер экрана", {
            prefs.isFeat("restore_comfort", true)
        }) { prefs.setFeat("restore_comfort", it) })
        comfort.addView(switchRow("Повышенный контраст", "Ночной свет / контраст устройства на время игры", {
            prefs.isFeat("night_light", false)
        }) { prefs.setFeat("night_light", it); onComfortChanged?.invoke() })
        p.addView(comfort, cardLp())

        val hud = cardBox()
        hud.addView(lbl("Пинг + FPS", 14f))
        hud.addView(mutedLbl("Одна компактная рамка поверх игры. FPS — framestats, затем SurfaceFlinger."))
        hud.addView(switchRow("Показывать пинг", "Измеренная задержка интернет-соединения", { prefs.isNetHud() }) {
            prefs.setNetHud(it); onOverlayToggles?.invoke()
        })
        hud.addView(switchRow("Показывать FPS", "Реальные кадры с авто-выбором источника", { prefs.isFpsHud() }) {
            prefs.setFpsHud(it); onOverlayToggles?.invoke()
        })
        p.addView(hud, cardLp())

        val kills = cardBox()
        kills.addView(lbl("Звуки убийств", 14f))
        kills.addView(mutedLbl("Когда вокруг игрового прицела вспыхивают красные палочки — звучит выбранный выкрик. На белые (попадание без убийства) звук не идёт."))
        kills.addView(switchRow("Звуки убийств", "Нужно разрешение на зеркалирование экрана (весь экран)", {
            prefs.isFeat("kill_sounds", false)
        }) {
            prefs.setFeat("kill_sounds", it); onOverlayToggles?.invoke()
        })
        p.addView(kills, cardLp())

        val tracks = cardBox()
        tracks.addView(lbl("Треки", 14f))
        tracks.addView(mutedLbl("Свой плейлист поверх игры. Музыка не прерывается при переходе между вкладками. MP3, M4A, OGG, WAV."))
        tracks.addView(lbl("Трек не выбран", 13f, muted).apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        tracks.addView(primaryBtn("Добавить треки") {
            Toast.makeText(ctx, "Выбери аудиофайлы (будет в следующем обновлении UI)", Toast.LENGTH_SHORT).show()
        }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) }
        })
        tracks.addView(mutedLbl("Плейлист пока пуст").apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        p.addView(tracks, cardLp())

        return p
    }

    private fun buildDiagPage(): LinearLayout {
        val p = page()
        p.addView(title("Диагностика", "Shizuku, дисплей, Game Mode, ровность кадров, FPS"))

        val dev = cardBox()
        deviceStatusBox = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        deviceStatusBox!!.addView(mutedLbl("Нажми «Обновить состояние»"))
        dev.addView(deviceStatusBox!!)
        dev.addView(primaryBtn("Обновить состояние") { onRefreshDevice?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) }
        })
        dev.addView(secondaryBtn("Выдать доступ к данным об использовании") { onRequestUsage?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        p.addView(dev, cardLp(10))

        val hz = cardBox()
        hz.addView(lbl("Максимальная герцовка", 14f))
        hz.addView(mutedLbl("Запрашивает максимальный режим дисплея через DisplayManager и системные параметры"))
        val row = LinearLayout(ctx).apply { orientation = LinearLayout.HORIZONTAL }
        row.addView(primaryBtn("Проверить сейчас") { onCheckMaxHz?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f).apply { marginEnd = dp(6) }
        })
        row.addView(secondaryBtn("Вернуть системную") { onRestoreHz?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(0, WRAP_CONTENT, 1f)
        })
        hz.addView(row, LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) })
        p.addView(hz, cardLp())

        val load = cardBox()
        load.addView(lbl("Детектор загрузки 100%", 14f))
        diagBox = LinearLayout(ctx).apply { orientation = LinearLayout.VERTICAL }
        diagBox!!.addView(mutedLbl("SMART_LOAD_100_RESULT: NOT_CONFIRMED"))
        load.addView(diagBox!!)
        load.addView(secondaryBtn("Обновить детектор") { onDiagRefresh?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        p.addView(load, cardLp())

        val gm = cardBox()
        gm.addView(lbl("Game Mode", 14f))
        gm.addView(mutedLbl("GAME_MODE_SNAPSHOT: —"))
        gm.addView(secondaryBtn("Обновить Game Mode") { onDiagRefresh?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        p.addView(gm, cardLp())

        val stab = cardBox()
        stab.addView(lbl("Ровность кадров", 14f))
        stab.addView(mutedLbl("Плавность — не количество кадров, а равномерность. Убираем скачки частот и системные ограничения с игры; клиент Standoff 2 не меняется."))
        stab.addView(mutedLbl("STABILITY_SNAPSHOT: false"))
        stab.addView(secondaryBtn("Обновить ровность") { onDiagRefresh?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        p.addView(stab, cardLp())

        val fps = cardBox()
        fps.addView(lbl("Диагностика FPS", 14f))
        fps.addView(mutedLbl("FPS: монитор ещё не запускался"))
        fps.addView(secondaryBtn("Обновить данные FPS") { onDiagRefresh?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        p.addView(fps, cardLp())

        return p
    }

    private fun buildSettingsPage(): LinearLayout {
        val p = page()
        p.addView(title("Настройки", "Внешний вид, Shizuku и данные приложения"))
        val prefs = AppPrefs(ctx)

        val theme = cardBox()
        theme.addView(lbl("Дизайн / акцент", 14f))
        theme.addView(mutedLbl("Сталь · Индиго · Аметист · и ваши прежние темы TurboBoost"))
        theme.addView(segment(listOf("Сталь", "Индиго", "Аметист", "Оранж."), prefs.getThemeIndex().coerceIn(0, 3)) {
            prefs.setThemeIndex(it)
            Toast.makeText(ctx, "Тема: ${ThemePalette.get(it).name}", Toast.LENGTH_SHORT).show()
        }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(10) }
        })
        p.addView(theme, cardLp(10))

        val sh = cardBox()
        sh.addView(lbl("Shizuku", 14f))
        sh.addView(mutedLbl("Статус: нужно разрешение"))
        sh.addView(secondaryBtn("Открыть Shizuku") { onOpenShizuku?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        sh.addView(secondaryBtn("Запросить разрешение") { onRequestShizuku?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(6) }
        })
        sh.addView(secondaryBtn("Разрешение оверлея") { onRequestOverlay?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(6) }
        })
        p.addView(sh, cardLp())

        val data = cardBox()
        data.addView(lbl("Данные приложения", 14f))
        data.addView(mutedLbl("История только на устройстве, без игровых данных."))
        data.addView(secondaryBtn("Очистить историю") {
            OpLog.clear()
            Toast.makeText(ctx, "Журнал очищен", Toast.LENGTH_SHORT).show()
        }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(8) }
        })
        data.addView(secondaryBtn("Старые настройки TurboBoost") { onSettings?.invoke() }.apply {
            layoutParams = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(6) }
        })
        p.addView(data, cardLp())

        return p
    }

    // ---------- public updates from MainActivity ----------
    fun setStatus(msg: String) {
        main.post { statusText?.text = msg }
    }

    fun setPackage(pkg: String) {
        main.post { pkgInput?.setText(pkg) }
    }

    fun setDeviceInfoLines(lines: List<String>) {
        main.post {
            val box = deviceStatusBox ?: return@post
            box.removeAllViews()
            lines.forEach { box.addView(lbl(it, 12f, if (it.contains(":") && !it.startsWith(" ")) muted else colText)) }
        }
    }

    fun setDiagLines(lines: List<String>) {
        main.post {
            val box = diagBox ?: return@post
            box.removeAllViews()
            lines.forEach { box.addView(lbl(it, 11f, muted)) }
        }
    }
}
