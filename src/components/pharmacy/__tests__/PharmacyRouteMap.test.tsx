import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PharmacyRouteMap } from "../PharmacyRouteMap";
import { NdaPharmacy } from "@/services/pharmacyService";

// Mock maplibre-gl
const mockSetLngLat = vi.fn().mockReturnThis();
const mockAddTo = vi.fn().mockReturnThis();
const mockRemove = vi.fn();
const mockSetData = vi.fn();
const mockFitBounds = vi.fn();
const mockFlyTo = vi.fn();
const mockResize = vi.fn();
const mockOn = vi.fn((event, callback) => {
  if (event === "load") {
    setTimeout(callback, 0);
  }
});
const mockGetSource = vi.fn().mockReturnValue({ setData: mockSetData });
const mockIsStyleLoaded = vi.fn().mockReturnValue(true);
const mockDisableCoop = vi.fn();
const mockEnableCoop = vi.fn();

vi.mock("maplibre-gl", () => {
  const MapMock = vi.fn(() => ({
    on: mockOn,
    addControl: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getLayer: vi.fn(),
    getStyle: vi.fn().mockReturnValue({}),
    getSource: mockGetSource,
    isStyleLoaded: mockIsStyleLoaded,
    resize: mockResize,
    fitBounds: mockFitBounds,
    flyTo: mockFlyTo,
    remove: mockRemove,
    cooperativeGestures: {
      disable: mockDisableCoop,
      enable: mockEnableCoop,
    },
  }));

  const MarkerMock = vi.fn(() => ({
    setLngLat: mockSetLngLat,
    addTo: mockAddTo,
    remove: mockRemove,
  }));

  const LngLatBoundsMock = vi.fn(() => ({
    extend: vi.fn().mockReturnThis(),
  }));

  return {
    default: {
      Map: MapMock,
      Marker: MarkerMock,
      LngLatBounds: LngLatBoundsMock,
    },
    Map: MapMock,
    Marker: MarkerMock,
    LngLatBounds: LngLatBoundsMock,
  };
});

vi.mock("@/services/mapTileService", () => ({
  initPmtilesProtocol: vi.fn(),
  COMPOSITE_PHARMACY_MAP_STYLE: "mapbox://styles/test",
  ESRI_SATELLITE_STYLE: "mapbox://styles/test-sat",
}));

const mockPharmacy: NdaPharmacy = {
  id: "pharm-1",
  name: "First Care Pharmacy",
  premiseNo: "NDA/2026/001",
  premiseType: "Retail Pharmacy",
  isRetail: true,
  isWholesale: false,
  expiryDate: "2026-12-31",
  address: "Plot 12 Kampala Road",
  street: "Kampala Road",
  pharmacist: "Dr. Jane Doe",
  psuNo: "PSU/1234",
  district: "Kampala",
  region: "Central",
  latitude: 0.3136,
  longitude: 32.5811,
  category: "Retail Pharmacy",
  verified: true,
  distanceKm: 1.2,
};

describe("PharmacyRouteMap - Full Screen Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the map container and fullscreen button in normal mode", () => {
    render(
      <PharmacyRouteMap
        userCoords={[32.58, 0.31]}
        topPharmacies={[mockPharmacy]}
        selectedPharmacy={mockPharmacy}
        route={null}
        onSelectPharmacy={vi.fn()}
      />
    );

    const fsButton = screen.getByTitle("Full Screen Map");
    expect(fsButton).toBeInTheDocument();
  });

  it("calls onToggleFullscreen when fullscreen button is clicked in controlled mode", () => {
    const handleToggle = vi.fn();
    render(
      <PharmacyRouteMap
        userCoords={[32.58, 0.31]}
        topPharmacies={[mockPharmacy]}
        selectedPharmacy={mockPharmacy}
        route={null}
        onSelectPharmacy={vi.fn()}
        isFullscreen={false}
        onToggleFullscreen={handleToggle}
      />
    );

    const fsButton = screen.getByTitle("Full Screen Map");
    fireEvent.click(fsButton);
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it("displays 'Exit Full Screen (Esc)' when isFullscreen is true", () => {
    render(
      <PharmacyRouteMap
        userCoords={[32.58, 0.31]}
        topPharmacies={[mockPharmacy]}
        selectedPharmacy={mockPharmacy}
        route={null}
        onSelectPharmacy={vi.fn()}
        isFullscreen={true}
        onToggleFullscreen={vi.fn()}
      />
    );

    const exitFsButton = screen.getByTitle("Exit Full Screen (Esc)");
    expect(exitFsButton).toBeInTheDocument();
  });

  it("invokes onToggleFullscreen when Escape key is pressed in fullscreen mode", () => {
    const handleToggle = vi.fn();
    render(
      <PharmacyRouteMap
        userCoords={[32.58, 0.31]}
        topPharmacies={[mockPharmacy]}
        selectedPharmacy={mockPharmacy}
        route={null}
        onSelectPharmacy={vi.fn()}
        isFullscreen={true}
        onToggleFullscreen={handleToggle}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });
});
