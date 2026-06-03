# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# Rive Android Runtime
-keep class app.rive.runtime.** { *; }
-keepclasseswithmembers class app.rive.runtime.** {
    native <methods>;
}

# Capacitor
-keep class com.getcapacitor.** { *; }

# ML Kit
-keep class com.google.mlkit.** { *; }
