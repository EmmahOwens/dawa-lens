import { useState, useEffect, useMemo, useCallback } from "react";
import { useGeolocation } from "./useGeolocation";
import { useNetworkStatus } from "./useNetworkStatus";
import { GeocodedPlace } from "../services/locationGeocodingService";
import {
  NdaPharmacy,
  PharmacyRoute,
  PharmacyTransportMode,
  findTopNearestPharmacies,
  findTopNearestDrugShops,
  findNearbyPharmacies,
  findNearbyDrugShops,
  getPharmacyRoute,
  fetchTopPharmaciesRoadDistances,
  getAllDistricts,
  getAllDrugShopDistricts,
  resolvePharmacyCoordinates,
  saveLastKnownLocation,
  DEFAULT_KAMPALA_COORDS,
} from "../services/pharmacyService";
import { applyCommunityFeedback } from "../services/pharmacyFeedbackService";

export interface CustomPharmacyLocation {
  coords: [number, number]; // [lng, lat]
  label: string;
  place?: GeocodedPlace;
}

export function useNearbyPharmacies() {
  const { location, status: geoStatus, requestLocation } = useGeolocation();
  const { isOnline } = useNetworkStatus();

  const isNetworkIssue = !isOnline || geoStatus === "error";

  const resolved = useMemo(() => {
    return resolvePharmacyCoordinates({
      liveLocation: geoStatus === "granted" ? location : null,
      hasNetworkIssue: isNetworkIssue,
    });
  }, [location, geoStatus, isNetworkIssue]);

  const userCoords = resolved.coords;
  const locationSource = resolved.source; // "live" | "previous" | "default"
  const isUsingPreviousLocation = locationSource === "previous";
  const isUsingDefaultLocation = locationSource === "default";

  // Persist live location when successfully obtained and online
  useEffect(() => {
    if (location && geoStatus === "granted" && !isNetworkIssue) {
      saveLastKnownLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        country: location.country,
        countryCode: location.countryCode,
      });
    }
  }, [location, geoStatus, isNetworkIssue]);

  // ── Custom Location (Geocoded via Photon / Pelias) ───────────────────────────
  const [customLocation, setCustomLocationState] = useState<CustomPharmacyLocation | null>(null);

  const setCustomLocation = useCallback(
    (coords: [number, number], label: string, place?: GeocodedPlace) => {
      setCustomLocationState({ coords, label, place });
    },
    []
  );

  const resetToLiveLocation = useCallback(() => {
    setCustomLocationState(null);
  }, []);

  const activeCoords = useMemo<[number, number]>(() => {
    if (customLocation) return customLocation.coords;
    return userCoords;
  }, [customLocation, userCoords]);

  const activeLocationLabel = useMemo(() => {
    if (customLocation) return customLocation.label;
    if (isUsingPreviousLocation) return "Previous Saved Location";
    if (isUsingDefaultLocation) return "Kampala (Default)";
    return "Device GPS Location";
  }, [customLocation, isUsingPreviousLocation, isUsingDefaultLocation]);

  // ── Shared state ─────────────────────────────────────────────────────────────
  const [transportMode, setTransportMode] = useState<PharmacyTransportMode>("boda_boda");
  const [selectedPharmacy, setSelectedPharmacy] = useState<NdaPharmacy | null>(null);
  const [route, setRoute] = useState<PharmacyRoute | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  // ── Pharmacy (outlet) state ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [radiusKm] = useState(25);

  const [rawTopPharmacies, setRawTopPharmacies] = useState<NdaPharmacy[]>(() =>
    findTopNearestPharmacies(activeCoords[1], activeCoords[0], 5, true)
  );

  const top5Pharmacies = useMemo(() => {
    const list = [...rawTopPharmacies].sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
    return applyCommunityFeedback(list);
  }, [rawTopPharmacies]);

  // ── Drug Shop state ───────────────────────────────────────────────────────────
  const [dsSearchQuery, setDsSearchQuery] = useState("");
  const [dsSelectedDistrict, setDsSelectedDistrict] = useState("ALL");

  const [rawTopDrugShops, setRawTopDrugShops] = useState<NdaPharmacy[]>(() =>
    findTopNearestDrugShops(activeCoords[1], activeCoords[0], 5)
  );

  const top5DrugShops = useMemo(() => {
    const list = [...rawTopDrugShops].sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
    return applyCommunityFeedback(list);
  }, [rawTopDrugShops]);

  // ── Pharmacy enrichment effect ───────────────────────────────────────────────
  useEffect(() => {
    const initialCandidates = findTopNearestPharmacies(activeCoords[1], activeCoords[0], 10, true);
    setRawTopPharmacies(initialCandidates.slice(0, 5));

    if (!isOnline) return;

    let isCancelled = false;
    fetchTopPharmaciesRoadDistances(activeCoords, initialCandidates, transportMode)
      .then((enriched) => {
        if (!isCancelled && enriched.length > 0) {
          const sorted = [...enriched]
            .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
            .slice(0, 5);

          setRawTopPharmacies(sorted);

          setSelectedPharmacy((prev) => {
            if (!prev || prev.outletType === "drug_shop") return prev;
            const updated = sorted.find((p) => p.id === prev.id);
            return updated || prev;
          });
        }
      })
      .catch((err) => {
        console.warn("[useNearbyPharmacies] Error enriching top road distances:", err);
      });

    return () => { isCancelled = true; };
  }, [activeCoords, transportMode, isOnline]);

  // ── Drug shop top-5 effect ────────────────────────────────────────────────────
  useEffect(() => {
    const initialDsTop10 = findTopNearestDrugShops(activeCoords[1], activeCoords[0], 10);
    setRawTopDrugShops(initialDsTop10.slice(0, 5));

    if (!isOnline) return;

    let isCancelled = false;
    fetchTopPharmaciesRoadDistances(activeCoords, initialDsTop10, transportMode)
      .then((enriched) => {
        if (!isCancelled && enriched.length > 0) {
          const sorted = [...enriched]
            .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
            .slice(0, 5);

          setRawTopDrugShops(sorted);

          setSelectedPharmacy((prev) => {
            if (!prev || prev.outletType === "pharmacy") return prev;
            const updated = sorted.find((d) => d.id === prev.id);
            return updated || prev;
          });
        }
      })
      .catch((err) => {
        console.warn("[useNearbyPharmacies] Error enriching drug shop road distances:", err);
      });

    return () => { isCancelled = true; };
  }, [activeCoords, transportMode, isOnline]);

  // ── Filtered lists ────────────────────────────────────────────────────────────
  const filteredPharmacies = useMemo(() => {
    const list = findNearbyPharmacies(activeCoords[1], activeCoords[0], {
      radiusKm,
      district: selectedDistrict,
      query: searchQuery,
      onlyRetail: true,
      limit: 60,
    });
    return applyCommunityFeedback(list);
  }, [activeCoords, radiusKm, selectedDistrict, searchQuery]);

  const filteredDrugShops = useMemo(() => {
    const list = findNearbyDrugShops(activeCoords[1], activeCoords[0], {
      radiusKm: 100,
      district: dsSelectedDistrict,
      query: dsSearchQuery,
      limit: 60,
    });
    return applyCommunityFeedback(list);
  }, [activeCoords, dsSelectedDistrict, dsSearchQuery]);

  // ── Auto-select nearest on load ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPharmacy && top5Pharmacies.length > 0) {
      setSelectedPharmacy(top5Pharmacies[0]);
    }
  }, [top5Pharmacies, selectedPharmacy]);

  // ── Route computation ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedPharmacy) {
      setRoute(null);
      return;
    }

    let isCancelled = false;
    setIsRouteLoading(true);

    const pharmacyCoords: [number, number] = [
      selectedPharmacy.longitude,
      selectedPharmacy.latitude,
    ];

    getPharmacyRoute(activeCoords, pharmacyCoords, transportMode)
      .then((res) => {
        if (!isCancelled) {
          setRoute(res);
          setIsRouteLoading(false);

          setSelectedPharmacy((prev) => {
            if (!prev) return prev;
            return { ...prev, distanceKm: res.distanceKm, durationMinutes: res.durationMinutes };
          });

          // Update appropriate top-5 list
          const updateList = (
            prev: NdaPharmacy[],
            setter: React.Dispatch<React.SetStateAction<NdaPharmacy[]>>
          ) => {
            const updated = prev.map((p) =>
              p.id === selectedPharmacy.id
                ? { ...p, distanceKm: res.distanceKm, durationMinutes: res.durationMinutes }
                : p
            );
            setter(
              [...updated].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
            );
          };

          if (selectedPharmacy.outletType === "drug_shop") {
            setRawTopDrugShops((prev) =>
              prev.map((p) =>
                p.id === selectedPharmacy.id
                  ? { ...p, distanceKm: res.distanceKm, durationMinutes: res.durationMinutes }
                  : p
              )
            );
          } else {
            setRawTopPharmacies((prev) =>
              prev.map((p) =>
                p.id === selectedPharmacy.id
                  ? { ...p, distanceKm: res.distanceKm, durationMinutes: res.durationMinutes }
                  : p
              )
            );
          }
        }
      })
      .catch((err) => {
        console.warn("[useNearbyPharmacies] Failed to compute route:", err);
        if (!isCancelled) setIsRouteLoading(false);
      });

    return () => { isCancelled = true; };
  }, [selectedPharmacy?.id, activeCoords, transportMode]);

  // ── District lists ────────────────────────────────────────────────────────────
  const allDistricts = useMemo(() => getAllDistricts(), []);
  const allDrugShopDistricts = useMemo(() => getAllDrugShopDistricts(), []);

  const selectTopPharmacyByIndex = useCallback(
    (index: number) => {
      if (top5Pharmacies[index]) setSelectedPharmacy(top5Pharmacies[index]);
    },
    [top5Pharmacies]
  );

  return {
    userCoords: activeCoords,
    deviceCoords: userCoords,
    activeCoords,
    customLocation,
    setCustomLocation,
    resetToLiveLocation,
    activeLocationLabel,
    isCustomLocation: !!customLocation,
    locationSource,
    isUsingPreviousLocation,
    isUsingDefaultLocation,
    isNetworkIssue,
    geoStatus,
    requestLocation,
    // Pharmacies (outlets)
    top5Pharmacies,
    filteredPharmacies,
    searchQuery,
    setSearchQuery,
    selectedDistrict,
    setSelectedDistrict,
    allDistricts,
    // Drug shops
    top5DrugShops,
    filteredDrugShops,
    dsSearchQuery,
    setDsSearchQuery,
    dsSelectedDistrict,
    setDsSelectedDistrict,
    allDrugShopDistricts,
    // Shared
    selectedPharmacy,
    setSelectedPharmacy,
    selectTopPharmacyByIndex,
    route,
    isRouteLoading,
    transportMode,
    setTransportMode,
  };
}
