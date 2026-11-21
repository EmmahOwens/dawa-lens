package com.dawainnovation.lens

import android.media.AudioAttributes
import android.media.SoundPool
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Hardware-Accelerated Android SoundPool Plugin for Zero-Latency UI & Dose Audio Feedback.
 *
 * Eliminates the 150–300ms WebView HTML5 `<audio>` decode delay, prevents `NotAllowedError`
 * autoplay blocks, and uses `USAGE_ASSISTANCE_SONIFICATION` so short UI/adherence chimes never
 * steal audio focus or pause the user's background music/podcasts.
 */
@CapacitorPlugin(name = "NativeSound")
class NativeSoundPlugin : Plugin() {

    private val audioExecutor: ExecutorService = Executors.newSingleThreadExecutor()
    private val loadedSamples = ConcurrentHashMap<String, Int>()
    private val readySamples = ConcurrentHashMap<Int, Boolean>()

    @Volatile
    private var soundPool: SoundPool? = null

    @Volatile
    private var lastStreamId: Int = 0

    @Volatile
    private var pendingPlaySampleId: Int = 0

    @Volatile
    private var pendingPlayVolume: Float = 0.8f

    private fun getOrInitSoundPool(): SoundPool {
        soundPool?.let { return it }
        synchronized(this) {
            soundPool?.let { return it }
            val attrs = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            val pool = SoundPool.Builder()
                .setMaxStreams(4)
                .setAudioAttributes(attrs)
                .build()
            pool.setOnLoadCompleteListener { sp, sampleId, status ->
                if (status == 0) {
                    readySamples[sampleId] = true
                    if (pendingPlaySampleId == sampleId) {
                        pendingPlaySampleId = 0
                        val vol = pendingPlayVolume
                        val prevStream = lastStreamId
                        if (prevStream != 0) {
                            try { sp.stop(prevStream) } catch (_: Exception) {}
                        }
                        lastStreamId = sp.play(sampleId, vol, vol, 1, 0, 1.0f)
                    }
                }
            }
            soundPool = pool
            return pool
        }
    }

    private fun resolveRawResId(resourceName: String): Int {
        if (!resourceName.matches(Regex("^[a-z0-9_]{1,80}$"))) return 0
        return context.resources.getIdentifier(resourceName, "raw", context.packageName)
    }

    @PluginMethod
    fun preload(call: PluginCall) {
        val resources = call.getArray("resources")
        audioExecutor.execute {
            try {
                val pool = getOrInitSoundPool()
                var count = 0
                if (resources != null) {
                    for (i in 0 until resources.length()) {
                        val name = resources.optString(i, "").trim()
                        if (name.isEmpty() || loadedSamples.containsKey(name)) continue
                        val resId = resolveRawResId(name)
                        if (resId != 0) {
                            val sampleId = pool.load(context, resId, 1)
                            if (sampleId > 0) {
                                loadedSamples[name] = sampleId
                                count++
                            }
                        }
                    }
                }
                call.resolve(JSObject().apply { put("loaded", count) })
            } catch (_: Exception) {
                call.resolve(JSObject().apply { put("loaded", 0) })
            }
        }
    }

    @PluginMethod
    fun play(call: PluginCall) {
        val resourceName = call.getString("resource")?.trim() ?: run {
            call.reject("resource is required")
            return
        }
        val volume = (call.getDouble("volume") ?: 0.8).toFloat().coerceIn(0f, 1f)

        audioExecutor.execute {
            try {
                val pool = getOrInitSoundPool()
                val existingId = loadedSamples[resourceName]

                if (existingId != null && readySamples[existingId] == true) {
                    pendingPlaySampleId = 0
                    val prevStream = lastStreamId
                    if (prevStream != 0) {
                        try { pool.stop(prevStream) } catch (_: Exception) {}
                    }
                    lastStreamId = pool.play(existingId, volume, volume, 1, 0, 1.0f)
                    call.resolve(JSObject().apply { put("played", lastStreamId != 0) })
                    return@execute
                }

                val resId = resolveRawResId(resourceName)
                if (resId == 0) {
                    call.resolve(JSObject().apply { put("played", false) })
                    return@execute
                }

                val sampleId = existingId ?: pool.load(context, resId, 1).also { id ->
                    if (id > 0) loadedSamples[resourceName] = id
                }

                if (sampleId <= 0) {
                    call.resolve(JSObject().apply { put("played", false) })
                    return@execute
                }

                // Trigger playback via the single registered OnLoadCompleteListener as soon as ready
                pendingPlayVolume = volume
                pendingPlaySampleId = sampleId
                // Re-check in case decode completed before pendingPlaySampleId was assigned
                if (readySamples[sampleId] == true && pendingPlaySampleId == sampleId) {
                    pendingPlaySampleId = 0
                    lastStreamId = pool.play(sampleId, volume, volume, 1, 0, 1.0f)
                }
                call.resolve(JSObject().apply { put("played", true) })
            } catch (_: Exception) {
                call.resolve(JSObject().apply { put("played", false) })
            }
        }
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        audioExecutor.execute {
            try {
                pendingPlaySampleId = 0
                val id = lastStreamId
                if (id != 0) {
                    soundPool?.stop(id)
                    lastStreamId = 0
                }
            } catch (_: Exception) {
            }
            call.resolve()
        }
    }

    override fun handleOnDestroy() {
        try {
            pendingPlaySampleId = 0
            soundPool?.release()
            soundPool = null
            loadedSamples.clear()
            readySamples.clear()
        } catch (_: Exception) {
        }
        audioExecutor.shutdown()
        super.handleOnDestroy()
    }
}
