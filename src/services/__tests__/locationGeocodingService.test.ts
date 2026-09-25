import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  formatPlaceDisplayName,
  normalizePhotonFeature,
  normalizePeliasFeature,
  searchPhotonSuggestions,
  searchPeliasSuggestions,
  searchAddressSuggestions,
  reverseGeocodeCoordinates,
  clearGeocodeCache,
  UGANDA_DEFAULT_BIAS,
} from "../locationGeocodingService";

describe("locationGeocodingService", () => {
  beforeEach(() => {
    clearGeocodeCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("formatPlaceDisplayName", () => {
    it("formats place parts correctly without duplicates", () => {
      const name = formatPlaceDisplayName({
        name: "Ntinda",
        locality: "Ntinda",
        district: "Nakawa",
        city: "Kampala",
        state: "Central Region",
        country: "Uganda",
      });

      expect(name).toBe("Ntinda, Nakawa, Kampala, Central Region, Uganda");
    });

    it("falls back gracefully when only name is provided", () => {
      expect(formatPlaceDisplayName({ name: "Kampala" })).toBe("Kampala");
    });
  });

  describe("normalizePhotonFeature", () => {
    it("converts a Photon GeoJSON feature into a GeocodedPlace with exact [lng, lat]", () => {
      const mockFeature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [32.6136, 0.3544], // [lng, lat]
        },
        properties: {
          osm_id: 12345,
          osm_type: "N",
          osm_key: "place",
          osm_value: "suburb",
          name: "Ntinda",
          district: "Nakawa",
          city: "Kampala",
          country: "Uganda",
          countrycode: "ug",
        },
      };

      const result = normalizePhotonFeature(mockFeature);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Ntinda");
      expect(result?.coordinates).toEqual([32.6136, 0.3544]);
      expect(result?.district).toBe("Nakawa");
      expect(result?.city).toBe("Kampala");
      expect(result?.country).toBe("Uganda");
      expect(result?.countryCode).toBe("UG");
      expect(result?.provider).toBe("photon");
    });

    it("returns null for features with invalid or missing coordinates", () => {
      expect(normalizePhotonFeature(null)).toBeNull();
      expect(normalizePhotonFeature({})).toBeNull();
      expect(normalizePhotonFeature({ geometry: { coordinates: ["invalid", 0] } })).toBeNull();
    });
  });

  describe("normalizePeliasFeature", () => {
    it("converts a Pelias GeoJSON feature into a GeocodedPlace", () => {
      const mockFeature = {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [32.5825, 0.3476],
        },
        properties: {
          id: "pelias-101",
          name: "Wandegeya",
          label: "Wandegeya, Kampala, Uganda",
          layer: "neighbourhood",
          locality: "Kampala",
          country: "Uganda",
          country_a: "UGA",
        },
      };

      const result = normalizePeliasFeature(mockFeature);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Wandegeya");
      expect(result?.displayName).toBe("Wandegeya, Kampala, Uganda");
      expect(result?.coordinates).toEqual([32.5825, 0.3476]);
      expect(result?.provider).toBe("pelias");
    });
  });

  describe("searchPhotonSuggestions", () => {
    it("returns empty array for queries shorter than 2 characters", async () => {
      const results = await searchPhotonSuggestions("a");
      expect(results).toEqual([]);
    });

    it("fetches suggestions from Photon API with Uganda location biasing", async () => {
      const mockResponse = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [32.6136, 0.3544],
            },
            properties: {
              name: "Ntinda",
              city: "Kampala",
              country: "Uganda",
            },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await searchPhotonSuggestions("Ntinda");

      expect(fetchSpy).toHaveBeenCalled();
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain("photon.komoot.io/api/");
      expect(calledUrl).toContain("q=Ntinda");
      expect(calledUrl).toContain(`lat=${UGANDA_DEFAULT_BIAS.lat}`);
      expect(calledUrl).toContain(`lon=${UGANDA_DEFAULT_BIAS.lon}`);

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Ntinda");
      expect(results[0].coordinates).toEqual([32.6136, 0.3544]);
    });

    it("caches results and returns cached entries on repeated queries", async () => {
      const mockResponse = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [32.58, 0.34] },
            properties: { name: "Kampala" },
          },
        ],
      };

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await searchPhotonSuggestions("Kampala");
      await searchPhotonSuggestions("Kampala");

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("handles network failure gracefully returning empty array", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network offline"));
      const results = await searchPhotonSuggestions("Entebbe");
      expect(results).toEqual([]);
    });
  });

  describe("reverseGeocodeCoordinates", () => {
    it("calls Photon reverse geocode endpoint and returns place", async () => {
      const mockResponse = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [32.5825, 0.3476] },
            properties: {
              name: "Kyebando",
              city: "Kampala",
              country: "Uganda",
            },
          },
        ],
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await reverseGeocodeCoordinates(0.3476, 32.5825);
      expect(result).not.toBeNull();
      expect(result?.name).toBe("Kyebando");
      expect(result?.coordinates).toEqual([32.5825, 0.3476]);
    });
  });

  describe("searchAddressSuggestions (Offline Uganda Gazetteer)", () => {
    it("falls back to local Uganda gazetteer when network is offline", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network offline"));

      const results = await searchAddressSuggestions("Kololo", { limit: 5 });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe("Kololo");
      expect(results[0].district).toBe("Kampala");
      expect(results[0].country).toBe("Uganda");
      expect(results[0].coordinates).toEqual([32.5936, 0.3292]);
    });

    it("matches towns and trading centers like Mbarara, Namanve, and Jinja offline", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({ features: [] }),
      } as Response);

      const namanve = await searchAddressSuggestions("Namanve");
      expect(namanve.length).toBeGreaterThan(0);
      expect(namanve[0].name).toContain("Namanve");

      const mbarara = await searchAddressSuggestions("Mbarara");
      expect(mbarara.length).toBeGreaterThan(0);
      expect(mbarara[0].name).toContain("Mbarara");
    });
  });
});
