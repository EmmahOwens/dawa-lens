package com.dawainnovation.lens

import android.content.Intent
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativeList")
class NativeListPlugin : Plugin() {

    @PluginMethod
    fun showList(call: PluginCall) {
        val data = call.getArray("data") ?: run {
            call.reject("Missing data")
            return
        }
        
        // In a real app, we would pass this data to a new Activity or Fragment
        val intent = Intent(context, NativeListActivity::class.java)
        intent.putExtra("data", data.toString())
        context.startActivity(intent)
        
        call.resolve()
    }
}
