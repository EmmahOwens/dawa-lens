import { useState, useEffect, useMemo, useCallback } from "react";
import { useGeolocation } from "./useGeolocation";
import { useNetworkStatus } from "./useNetworkStatus";
import {
  NdaPharmacy,
  PharmacyRoute,
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

  // ── Shared state ─────────────────────────────────────────────────────────────
  const [transportMode, setTransportMode] = useState<"driving" | "walking">("driving");
  const [selectedPharmacy, setSelectedPharmacy] = useState<NdaPharmacy | null>(null);
  const [route, setRoute] = useState<PharmacyRoute | null>(null);
  const [isRouteLoading, setIsRouteLoading] = useState(false);

  // ── Pharmacy (outlet) state ───────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("ALL");
  const [radiusKm] = useState(25);

  const [rawTopPharmacies, setRawTopPharmacies] = useState<NdaPharmacy[]>(() =>
    findTopNearestPharmacies(userCoords[1], userCoords[0], 5, true)
  );

  const top5Pharmacies = useMemo(() => {
    return [...rawTopPharmacies].sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  }, [rawTopPharmacies]);

  // ── Drug Shop state ───────────────────────────────────────────────────────────
  const [dsSearchQuery, setDsSearchQuery] = useState("");
  const [dsSelectedDistrict, setDsSelectedDistrict] = useState("ALL");

  const [rawTopDrugShops, setRawTopDrugShops] = useState<NdaPharmacy[]>(() =>
    findTopNearestDrugShops(userCoords[1], userCoords[0], 5)
  );

  const top5DrugShops = useMemo(() => {
    return [...rawTopDrugShops].sort(
      (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    );
  }, [rawTopDrugShops]);

  // ── Pharmacy enrichment effect ───────────────────────────────────────────────
  useEffect(() => {
    const initialCandidates = findTopNearestPharmacies(userCoords[1], userCoords[0], 10, true);
    setRawTopPharmacies(initialCandidates.slice(0, 5));

    if (!isOnline) return;

    let isCancelled = false;
    fetchTopPharmaciesRoadDistances(userCoords, initialCandidates, transportMode)
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
  }, [userCoords, transportMode, isOnline]);

  // ── Drug shop top-5 effect ────────────────────────────────────────────────────
  useEffect(() => {
    const initialDsTop10 = findTopNearestDrugShops(userCoords[1], userCoords[0], 10);
    setRawTopDrugShops(initialDsTop10.slice(0, 5));

    if (!isOnline) return;

    let isCancelled = false;
    fetchTopPharmaciesRoadDistances(userCoords, initialDsTop10, transportMode)
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
  }, [userCoords, transportMode, isOnline]);

  // ── Filtered lists ────────────────────────────────────────────────────────────
  const filteredPharmacies = useMemo(() =>
    findNearbyPharmacies(userCoords[1], userCoords[0], {
      radiusKm,
      district: selectedDistrict,
      query: searchQuery,
      onlyRetail: true,
      limit: 60,
    }),
    [userCoords, radiusKm, selectedDistrict, searchQuery]
  );

  const filteredDrugShops = useMemo(() =>
    findNearbyDrugShops(userCoords[1], userCoords[0], {
      radiusKm: 100,
      district: dsSelectedDistrict,
      query: dsSearchQuery,
      limit: 60,
    }),
    [userCoords, dsSelectedDistrict, dsSearchQuery]
  );

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

    getPharmacyRoute(userCoords, pharmacyCoords, transportMode)
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
            setRawTopDrugShops((prev) => {
              const updated = prev.map((p) =>
                p.id === selectedPharmacy.id
                  ? { ...p, distanceKm: res.distanceKm, durationMinutes: res.durationMinutes }
                  : p
              );
              return [...updated].sort(
                (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
              );
            });
          } else {
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
        }
      })
      .catch((err) => {
        console.warn("[useNearbyPharmacies] Failed to compute route:", err);
        if (!isCancelled) setIsRouteLoading(false);
      });

    return () => { isCancelled = true; };
  }, [selectedPharmacy?.id, userCoords, transportMode]);

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
    userCoords,
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
