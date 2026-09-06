import { useState, useEffect, useMemo, useCallback } from "react";
import { useGeolocation } from "./useGeolocation";
import {
  NdaPharmacy,
  PharmacyRoute,
  findTopNearestPharmacies,
  findNearbyPharmacies,
  getPharmacyRoute,
  fetchTopPharmaciesRoadDistances,
  getAllDistricts,
} from "../services/pharmacyService";

const DEFAULT_USER_COORDS: [number, number] = [32.5825, 0.3476]; // [lng, lat] Kampala

export function useNearbyPharmacies() {
  const { location, status: geoStatus, requestLocation } = useGeolocation();

  const userCoords = useMemo<[number, number]>(() => {
    if (location && typeof location.longitude === "number" && typeof location.latitude === "number") {
      return [location.longitude, location.latitude];
    }
    return DEFAULT_USER_COORDS;
  }, [location]);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [radiusKm, setRadiusKm] = useState(25);
  const [transportMode, setTransportMode] = useState<"driving" | "walking">("driving");
  const [selectedPharmacy, setSelectedPharmacy] = useState<NdaPharmacy | null>(null);
  const [route, setRoute] = useState<PharmacyRoute | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  // Top 5 nearest pharmacies reactive state
  const [top5Pharmacies, setTop5Pharmacies] = useState<NdaPharmacy[]>(() =>
    findTopNearestPharmacies(userCoords[1], userCoords[0], 5, true)
  );

  // Immediately compute initial top 5 by geographic proximity, then enrich with live road distances
  useEffect(() => {
    const initialTop5 = findTopNearestPharmacies(userCoords[1], userCoords[0], 5, true);
    setTop5Pharmacies(initialTop5);

    let isCancelled = false;
    fetchTopPharmaciesRoadDistances(userCoords, initialTop5, transportMode)
      .then((enriched) => {
        if (!isCancelled && enriched.length > 0) {
          setTop5Pharmacies(enriched);
        }
      })
      .catch((err) => {
        console.warn("[useNearbyPharmacies] Error enriching top 5 road distances:", err);
      });

    return () => {
      isCancelled = true;
    };
  }, [userCoords, transportMode]);

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

          // Synchronize selectedPharmacy and top5Pharmacies with actual road route distance
          setSelectedPharmacy((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              distanceKm: res.distanceKm,
              durationMinutes: res.durationMinutes,
            };
          });

          setTop5Pharmacies((prev) =>
            prev.map((p) =>
              p.id === selectedPharmacy.id
                ? { ...p, distanceKm: res.distanceKm, durationMinutes: res.durationMinutes }
                : p
            )
          );
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
