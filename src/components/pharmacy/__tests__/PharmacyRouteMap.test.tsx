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

  it("renders transport mean selector in top-left and invokes onTransportModeChange", () => {
    const handleTransportChange = vi.fn();
    render(
      <PharmacyRouteMap
        userCoords={[32.58, 0.31]}
        topPharmacies={[mockPharmacy]}
        selectedPharmacy={mockPharmacy}
        route={null}
        onSelectPharmacy={vi.fn()}
        isFullscreen={true}
        transportMode="boda_boda"
        onTransportModeChange={handleTransportChange}
      />
    );

    // Desktop transport selector button
    const driveButtons = screen.getAllByRole("button", { name: /Driving route/i });
    expect(driveButtons.length).toBeGreaterThan(0);
    fireEvent.click(driveButtons[0]);
    expect(handleTransportChange).toHaveBeenCalledWith("driving");

    const walkButtons = screen.getAllByRole("button", { name: /Walking route/i });
    expect(walkButtons.length).toBeGreaterThan(0);
    fireEvent.click(walkButtons[0]);
    expect(handleTransportChange).toHaveBeenCalledWith("walking");
  });

  it("renders outlet switcher and toggles between Pharmacies and Drug Shops in full screen mode", () => {
    const handleOutletTabChange = vi.fn();
    render(
      <PharmacyRouteMap
        userCoords={[32.58, 0.31]}
        topPharmacies={[mockPharmacy]}
        selectedPharmacy={mockPharmacy}
        route={null}
        onSelectPharmacy={vi.fn()}
        isFullscreen={true}
        outletTab="pharmacy"
        onOutletTabChange={handleOutletTabChange}
      />
    );

    const drugShopButtons = screen.getAllByRole("button", { name: /Drug Shops/i });
    expect(drugShopButtons.length).toBeGreaterThan(0);
    fireEvent.click(drugShopButtons[0]);
    expect(handleOutletTabChange).toHaveBeenCalledWith("drug_shop");
  });

  it("renders top 5 nearest cards across the top and selects an outlet on click", () => {
    const secondPharmacy: NdaPharmacy = {
      ...mockPharmacy,
      id: "pharm-2",
      name: "Second Care Pharmacy",
      distanceKm: 2.1,
    };
    const handleSelect = vi.fn();

    render(
      <PharmacyRouteMap
        userCoords={[32.58, 0.31]}
        topPharmacies={[mockPharmacy, secondPharmacy]}
        selectedPharmacy={mockPharmacy}
        route={null}
        onSelectPharmacy={handleSelect}
        isFullscreen={true}
      />
    );

    // Rank badges and cards exist
    const secondCards = screen.getAllByText("Second Care Pharmacy");
    expect(secondCards.length).toBeGreaterThan(0);
    fireEvent.click(secondCards[0]);
    expect(handleSelect).toHaveBeenCalledWith(secondPharmacy);
  });

  it("renders selected outlet details on desktop card and supports collapse/expand", () => {
    render(
      <PharmacyRouteMap
        userCoords={[32.58, 0.31]}
        topPharmacies={[mockPharmacy]}
        selectedPharmacy={mockPharmacy}
        route={null}
        onSelectPharmacy={vi.fn()}
        isFullscreen={true}
      />
    );

    // Pharmacist and License details rendered
    expect(screen.getByText("Dr. Jane Doe")).toBeInTheDocument();
    expect(screen.getAllByText("NDA/2026/001").length).toBeGreaterThan(0);

    // Collapse desktop card
    const collapseBtn = screen.getByTitle("Collapse details for full map view");
    fireEvent.click(collapseBtn);

    // Collapsed trigger pill is visible
    const expandPill = screen.getByTitle("Expand selected outlet details");
    expect(expandPill).toBeInTheDocument();

    // Clicking expands it back
    fireEvent.click(expandPill);
    expect(screen.getByTitle("Collapse details for full map view")).toBeInTheDocument();
  });

  it("renders mobile equivalents: bottom drawer with directions and expandable details", () => {
    const handleNavigate = vi.fn();
    render(
      <PharmacyRouteMap
        userCoords={[32.58, 0.31]}
        topPharmacies={[mockPharmacy]}
        selectedPharmacy={mockPharmacy}
        route={null}
        onSelectPharmacy={vi.fn()}
        isFullscreen={true}
        onNavigate={handleNavigate}
      />
    );

    // Mobile bottom drawer has Directions button
    const directionsBtn = screen.getByRole("button", { name: /Directions/i });
    expect(directionsBtn).toBeInTheDocument();
    fireEvent.click(directionsBtn);
    expect(handleNavigate).toHaveBeenCalledWith(mockPharmacy);

    // Expand mobile bottom sheet
    const expandBtn = screen.getByLabelText("Expand sheet");
    fireEvent.click(expandBtn);

    // Check expanded details (e.g. Call, Share buttons)
    expect(screen.getAllByRole("button", { name: /Share/i }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Collapse sheet")).toBeInTheDocument();
  });
});
