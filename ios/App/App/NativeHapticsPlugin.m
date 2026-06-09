#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(NativeHapticsPlugin, "NativeHaptics",
           CAP_PLUGIN_METHOD(impact, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(notification, CAPPluginReturnPromise);
)
