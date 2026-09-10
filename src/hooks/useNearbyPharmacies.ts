import { useState, useEffect, useMemo, useCallback } from "react";
import { useGeolocation } from "./useGeolocation";
import { useNetworkStatus } from "./useNetworkStatus";
import {
  NdaPharmacy,
  PharmacyRoute,
  findTopNearestPharmacies,
  findNearbyPharmacies,
  getPharmacyRoute,
  fetchTopPharmaciesRoadDistances,
  getAllDistricts,
  resolvePharmacyCoordinates,
  saveLastKnownLocation,
  DEFAULT_KAMPALA_COORDS,
} from "../services/pharmacyService";

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

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [radiusKm, setRadiusKm] = useState(25);
  const [transportMode, setTransportMode] = useState<"driving" | "walking">("driving");
  const [selectedPharmacy, setSelectedPharmacy] = useState<NdaPharmacy | null>(null);
  const [route, setRoute] = useState<PharmacyRoute | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  // Top 5 nearest pharmacies reactive state
  const [rawTopPharmacies, setRawTopPharmacies] = useState<NdaPharmacy[]>(() =>
    findTopNearestPharmacies(userCoords[1], userCoords[0], 5, true)
  );

  // Always enforce strict ascending order from nearest distance to farthest
  const top5Pharmacies = useMemo(() => {
    return [...rawTopPharmacies].sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  }, [rawTopPharmacies]);

  // Immediately compute initial candidates by geographic proximity, then enrich and sort by live road distances
  useEffect(() => {
    // Check top 10 candidates by proximity to ensure true top 5 nearest road routes are selected
    const initialCandidates = findTopNearestPharmacies(userCoords[1], userCoords[0], 10, true);
    setRawTopPharmacies(initialCandidates.slice(0, 5));

    if (!isOnline) {
      // In offline / network issue mode, use direct proximity calculations without blocking network calls
      return;
    }

    let isCancelled = false;
    fetchTopPharmaciesRoadDistances(userCoords, initialCandidates, transportMode)
      .then((enriched) => {
        if (!isCancelled && enriched.length > 0) {
          // Sort strictly in ascending order from nearest road distance to farthest, take top 5
          const sorted = [...enriched]
            .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
            .slice(0, 5);

          setRawTopPharmacies(sorted);

          // Auto-select the nearest pharmacy if none selected yet
          setSelectedPharmacy((prev) => {
            if (!prev) return sorted[0];
            const updated = sorted.find((p) => p.id === prev.id);
            return updated || prev;
          });
        }
      })
      .catch((err) => {
        console.warn("[useNearbyPharmacies] Error enriching top road distances:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [userCoords, transportMode, isOnline]);

  // Filtered / searched list of pharmacies
  const filteredPharmacies = useMemo(() => {
    return findNearbyPharmacies(userCoords[1], userCoords[0], {
      radiusKm,
      district: selectedDistrict,
      query: searchQuery,
      onlyRetail: true,
      limit: 60,
    });
  }, [userCoords, radiusKm, selectedDistrict, searchQuery]);

  // Auto-select the top 1 nearest pharmacy on initial load if none selected
  useEffect(() => {
    if (!selectedPharmacy && top5Pharmacies.length > 0) {
      setSelectedPharmacy(top5Pharmacies[0]);
    }
  }, [top5Pharmacies, selectedPharmacy]);

  // Fetch / update road route when selected pharmacy or transport mode changes
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

    getPharmacyRoute(userCoords, pharmacyCoords, transportMode)
      .then((res) => {
        if (!isCancelled) {
          setRoute(res);
          setIsRouteLoading(false);

          // Synchronize selectedPharmacy and rawTopPharmacies with actual road route distance
          setSelectedPharmacy((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              distanceKm: res.distanceKm,
              durationMinutes: res.durationMinutes,
            };
          });

          setRawTopPharmacies((prev) => {
            const updated = prev.map((p) =>
              p.id === selectedPharmacy.id
                ? { ...p, distanceKm: res.distanceKm, durationMinutes: res.durationMinutes }
                : p
            );
            return [...updated].sort(
              (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
            );
          });
        }
      })
      .catch((err) => {
        console.warn("[useNearbyPharmacies] Failed to compute route:", err);
        if (!isCancelled) {
          setIsRouteLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedPharmacy?.id, userCoords, transportMode]);

  const allDistricts = useMemo(() => getAllDistricts(), []);

  const selectTopPharmacyByIndex = useCallback(
    (index: number) => {
      if (top5Pharmacies[index]) {
        setSelectedPharmacy(top5Pharmacies[index]);
      }
    },
    [top5Pharmacies]
  );

  return {
    userCoords,
    locationSource,
    isUsingPreviousLocation,
    isUsingDefaultLocation,
    isNetworkIssue,
    geoStatus,
    requestLocation,
    top5Pharmacies,
    filteredPharmacies,
    selectedPharmacy,
    setSelectedPharmacy,
    selectTopPharmacyByIndex,
    route,
    isRouteLoading,
    transportMode,
    setTransportMode,
    radiusKm,
    setRadiusKm,
    searchQuery,
    setSearchQuery,
    selectedDistrict,
    setSelectedDistrict,
    allDistricts,
  };
}
