package com.dawainnovation.lens

import android.Manifest
import android.content.Context
import android.location.Geocoder
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import java.util.Locale

@CapacitorPlugin(
    name = "NativeLocation",
    permissions = [
        Permission(strings = [Manifest.permission.ACCESS_COARSE_LOCATION], alias = "coarseLocation"),
        Permission(strings = [Manifest.permission.ACCESS_FINE_LOCATION],   alias = "fineLocation")
    ]
)
class NativeLocationPlugin : Plugin() {

    companion object {
        private const val PREFS_NAME   = "dawa_location"
        private const val KEY_COUNTRY  = "loc_country"
        private const val KEY_CODE     = "loc_code"
        private const val KEY_LAT      = "loc_lat"
        private const val KEY_LNG      = "loc_lng"
        private const val KEY_TIMESTAMP = "loc_timestamp"
        private const val CACHE_TTL_MS = 30L * 60L * 1000L   // 30 minutes

        // Uganda fallback — used when GPS/Geocoder is unavailable
        private const val FALLBACK_COUNTRY = "Uganda"
        private const val FALLBACK_CODE    = "UG"
        private const val FALLBACK_LAT     = 0.3476
        private const val FALLBACK_LNG     = 32.5825
    }

    // ── Public plugin methods ────────────────────────────────────────────────────

    @PluginMethod
    fun getCachedCountry(call: PluginCall) {
        val prefs    = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val cached   = prefs.getLong(KEY_TIMESTAMP, 0L)
        val now      = System.currentTimeMillis()

        // Return cached data if still within TTL
        if (cached > 0L && (now - cached) < CACHE_TTL_MS) {
            call.resolve(JSObject().apply {
                put("country",     prefs.getString(KEY_COUNTRY, FALLBACK_COUNTRY))
                put("countryCode", prefs.getString(KEY_CODE,    FALLBACK_CODE))
                put("lat",  prefs.getFloat(KEY_LAT, FALLBACK_LAT.toFloat()).toDouble())
                put("lng",  prefs.getFloat(KEY_LNG, FALLBACK_LNG.toFloat()).toDouble())
                put("fromCache", true)
            })
            return
        }

        // Need a fresh location — ensure runtime permission first
        if (getPermissionState("coarseLocation") != PermissionState.GRANTED) {
            requestPermissionForAlias("coarseLocation", call, "locationPermissionCallback")
            return
        }

        fetchFreshLocation(call)
    }

    @PluginMethod
    fun clearCache(call: PluginCall) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().clear().apply()
        call.resolve()
    }

    // ── Permission callback ──────────────────────────────────────────────────────

    @PermissionCallback
    private fun locationPermissionCallback(call: PluginCall) {
        if (getPermissionState("coarseLocation") == PermissionState.GRANTED) {
            fetchFreshLocation(call)
        } else {
            // User denied — fall back to Uganda rather than rejecting
            resolveWithFallback(call)
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────────────

    private fun fetchFreshLocation(call: PluginCall) {
        val fusedClient = LocationServices.getFusedLocationProviderClient(context)
        try {
            @Suppress("MissingPermission")
            fusedClient.lastLocation
                .addOnSuccessListener { location ->
                    if (location != null) {
                        reverseGeocodeAndResolve(call, location.latitude, location.longitude)
                    } else {
                        // lastLocation can be null on fresh boots or if GPS was never used;
                        // fall through to getCurrentLocation for a one-shot fix.
                        requestCurrentLocation(call, fusedClient)
                    }
                }
                .addOnFailureListener { resolveWithFallback(call) }
        } catch (e: Exception) {
            resolveWithFallback(call)
        }
    }

    private fun requestCurrentLocation(call: PluginCall, fusedClient: FusedLocationProviderClient) {
        try {
            val cts = CancellationTokenSource()
            @Suppress("MissingPermission")
            fusedClient.getCurrentLocation(Priority.PRIORITY_BALANCED_POWER_ACCURACY, cts.token)
                .addOnSuccessListener { location ->
                    if (location != null) {
                        reverseGeocodeAndResolve(call, location.latitude, location.longitude)
                    } else {
                        resolveWithFallback(call)
                    }
                }
                .addOnFailureListener { resolveWithFallback(call) }
        } catch (e: Exception) {
            resolveWithFallback(call)
        }
    }

    private fun reverseGeocodeAndResolve(call: PluginCall, lat: Double, lng: Double) {
        if (!Geocoder.isPresent()) {
            // No network geocoder available on this device — use fallback
            resolveWithFallback(call)
            return
        }
        val geocoder = Geocoder(context, Locale.getDefault())

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            // API 33+ provides an async callback — runs on the calling thread pool already
            geocoder.getFromLocation(lat, lng, 1) { addresses ->
                if (addresses.isNotEmpty()) {
                    val addr = addresses[0]
                    saveAndResolve(
                        call,
                        addr.countryName  ?: FALLBACK_COUNTRY,
                        addr.countryCode  ?: FALLBACK_CODE,
                        lat, lng
                    )
                } else {
                    resolveWithFallback(call)
                }
            }
        } else {
            // Pre-33: synchronous network call — run on a background thread
            Thread {
                try {
                    @Suppress("DEPRECATION")
                    val addresses = geocoder.getFromLocation(lat, lng, 1)
                    if (!addresses.isNullOrEmpty()) {
                        val addr = addresses[0]
                        saveAndResolve(
                            call,
                            addr.countryName  ?: FALLBACK_COUNTRY,
                            addr.countryCode  ?: FALLBACK_CODE,
                            lat, lng
                        )
                    } else {
                        resolveWithFallback(call)
                    }
                } catch (e: Exception) {
                    resolveWithFallback(call)
                }
            }.start()
        }
    }

    private fun saveAndResolve(
        call: PluginCall,
        country: String, code: String,
        lat: Double, lng: Double
    ) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
            .putString(KEY_COUNTRY, country)
            .putString(KEY_CODE,    code)
            .putFloat(KEY_LAT,      lat.toFloat())
            .putFloat(KEY_LNG,      lng.toFloat())
            .putLong(KEY_TIMESTAMP, System.currentTimeMillis())
            .apply()

        call.resolve(JSObject().apply {
            put("country",     country)
            put("countryCode", code)
            put("lat",  lat)
            put("lng",  lng)
            put("fromCache", false)
        })
    }

    private fun resolveWithFallback(call: PluginCall) {
        call.resolve(JSObject().apply {
            put("country",     FALLBACK_COUNTRY)
            put("countryCode", FALLBACK_CODE)
            put("lat",  FALLBACK_LAT)
            put("lng",  FALLBACK_LNG)
            put("fromCache", false)
        })
    }
}
