import Foundation
import Capacitor
import CoreLocation

@objc(NativeLocationPlugin)
public class NativeLocationPlugin: CAPPlugin, CAPBridgedPlugin, CLLocationManagerDelegate {
    public let identifier = "NativeLocationPlugin"
    public let jsName = "NativeLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getCachedCountry", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCache", returnType: CAPPluginReturnPromise),
    ]

    private let locationManager = CLLocationManager()
    private var pendingCall: CAPPluginCall?
    private let defaults = UserDefaults(suiteName: "com.dawainnovation.lens.location")!
    private let ttlSeconds: TimeInterval = 30 * 60 // 30 minutes

    // Fallback coordinates: Kampala, Uganda
    private let defaultCountry = "Uganda"
    private let defaultCode = "UG"
    private let defaultLat = 0.3476
    private let defaultLng = 32.5825

    @objc func getCachedCountry(_ call: CAPPluginCall) {
        // Return cached result if it is still within TTL
        if let ts = defaults.object(forKey: "loc_timestamp") as? TimeInterval,
           Date().timeIntervalSince1970 - ts < ttlSeconds,
           let country = defaults.string(forKey: "loc_country"),
           let code = defaults.string(forKey: "loc_code") {
            let lat = defaults.double(forKey: "loc_lat")
            let lng = defaults.double(forKey: "loc_lng")
            var result = JSObject()
            result["country"] = country
            result["countryCode"] = code
            result["lat"] = lat
            result["lng"] = lng
            result["fromCache"] = true
            call.resolve(result)
            return
        }

        // Request fresh location — delegate callbacks happen on main thread
        pendingCall = call
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.locationManager.delegate = self
            self.locationManager.desiredAccuracy = kCLLocationAccuracyKilometer
            let status = self.locationManager.authorizationStatus
            if status == .notDetermined {
                self.locationManager.requestWhenInUseAuthorization()
            } else if status == .denied || status == .restricted {
                self.resolveWithDefault(call, fromCache: false)
                self.pendingCall = nil
            } else {
                self.locationManager.requestLocation()
            }
        }

        // Safety timeout: resolve with default after 10 seconds if no response
        DispatchQueue.global().asyncAfter(deadline: .now() + 10) { [weak self] in
            guard let self = self, self.pendingCall != nil else { return }
            self.resolveWithDefault(call, fromCache: false)
            self.pendingCall = nil
        }
    }

    // MARK: – CLLocationManagerDelegate

    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let call = pendingCall, let location = locations.first else { return }
        pendingCall = nil

        // Reverse geocoding is network I/O — run off the main thread
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self = self else { return }
            CLGeocoder().reverseGeocodeLocation(location) { placemarks, error in
                guard let placemark = placemarks?.first, error == nil else {
                    self.resolveWithDefault(call, fromCache: false)
                    return
                }
                let country = placemark.country ?? self.defaultCountry
                let code = placemark.isoCountryCode ?? self.defaultCode
                let lat = location.coordinate.latitude
                let lng = location.coordinate.longitude

                // Persist for next call within TTL
                self.defaults.set(country, forKey: "loc_country")
                self.defaults.set(code, forKey: "loc_code")
                self.defaults.set(lat, forKey: "loc_lat")
                self.defaults.set(lng, forKey: "loc_lng")
                self.defaults.set(Date().timeIntervalSince1970, forKey: "loc_timestamp")

                var result = JSObject()
                result["country"] = country
                result["countryCode"] = code
                result["lat"] = lat
                result["lng"] = lng
                result["fromCache"] = false
                call.resolve(result)
            }
        }
    }

    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard let call = pendingCall else { return }
        pendingCall = nil
        resolveWithDefault(call, fromCache: false)
    }

    public func locationManager(_ manager: CLLocationManager,
                                didChangeAuthorization status: CLAuthorizationStatus) {
        if status == .authorizedWhenInUse || status == .authorizedAlways {
            locationManager.requestLocation()
        } else if status == .denied || status == .restricted {
            if let call = pendingCall {
                resolveWithDefault(call, fromCache: false)
                pendingCall = nil
            }
        }
    }

    // MARK: – Helpers

    private func resolveWithDefault(_ call: CAPPluginCall, fromCache: Bool) {
        var result = JSObject()
        result["country"] = defaultCountry
        result["countryCode"] = defaultCode
        result["lat"] = defaultLat
        result["lng"] = defaultLng
        result["fromCache"] = fromCache
        call.resolve(result)
    }

    @objc func clearCache(_ call: CAPPluginCall) {
        ["loc_country", "loc_code", "loc_lat", "loc_lng", "loc_timestamp"].forEach {
            defaults.removeObject(forKey: $0)
        }
        call.resolve()
    }
}
