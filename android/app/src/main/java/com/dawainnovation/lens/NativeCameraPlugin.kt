package com.dawainnovation.lens

import android.app.Activity
import android.content.Intent
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativeCamera")
class NativeCameraPlugin : Plugin() {

    private val RC_SCAN = 9901
    private var savedCall: PluginCall? = null

    @PluginMethod(returnType = PluginMethod.RETURN_PROMISE)
    fun startScan(call: PluginCall) {
        val mode = call.getString("mode") ?: "pill"
        savedCall = call

        val intent = Intent(activity, NativeScanActivity::class.java).apply {
            putExtra("SCAN_MODE", mode)
        }

        startActivityForResult(call, intent, RC_SCAN)
    }

    override fun handleOnActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.handleOnActivityResult(requestCode, resultCode, data)

        if (requestCode != RC_SCAN) return

        val call = savedCall ?: return
        savedCall = null

        val result = JSObject()
        if (resultCode == Activity.RESULT_OK) {
            val imageData = data?.getStringExtra("IMAGE_DATA") ?: ""
            result.put("imageData", imageData)
            result.put("cancelled", false)
        } else {
            result.put("imageData", "")
            result.put("cancelled", true)
        }

        call.resolve(result)
    }
}
