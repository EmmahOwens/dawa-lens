import * as React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PharmacyFinderModal } from "../PharmacyFinderModal";

// Mock MapLibre
vi.mock("maplibre-gl", () => ({
  default: {
    Map: vi.fn(() => ({
      on: vi.fn(),
      resize: vi.fn(),
      fitBounds: vi.fn(),
      remove: vi.fn(),
      cooperativeGestures: { disable: vi.fn(), enable: vi.fn() },
    })),
    Marker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
    LngLatBounds: vi.fn(() => ({ extend: vi.fn().mockReturnThis() })),
  },
  Map: vi.fn(() => ({
    on: vi.fn(),
    resize: vi.fn(),
    fitBounds: vi.fn(),
    remove: vi.fn(),
    cooperativeGestures: { disable: vi.fn(), enable: vi.fn() },
  })),
  Marker: vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  })),
  LngLatBounds: vi.fn(() => ({ extend: vi.fn().mockReturnThis() })),
}));

vi.mock("@/services/mapTileService", () => ({
  initPmtilesProtocol: vi.fn(),
  COMPOSITE_PHARMACY_MAP_STYLE: "mapbox://styles/test",
  ESRI_SATELLITE_STYLE: "mapbox://styles/test-sat",
}));

const mockPharmacy = {
  id: "test-pharm-1",
  name: "Victoria Hospital Pharmacy",
  premiseNo: "NDA/UG/001",
  district: "Kampala",
  address: "Plot 14 Jinja Road",
  latitude: 0.315,
  longitude: 32.585,
  category: "Retail Pharmacy",
  outletType: "pharmacy" as const,
  distanceKm: 0.8,
  phone: "+256700000000",
};

const mockSetSelectedPharmacy = vi.fn();
const mockSetTransportMode = vi.fn();

vi.mock("@/hooks/useNearbyPharmacies", () => ({
  useNearbyPharmacies: () => ({
    userCoords: [32.58, 0.31] as [number, number],
    deviceCoords: [32.58, 0.31] as [number, number],
    customLocation: null,
    setCustomLocation: vi.fn(),
    resetToLiveLocation: vi.fn(),
    activeLocationLabel: "Kampala Central",
    isCustomLocation: false,
    isUsingPreviousLocation: false,
    isNetworkIssue: false,
    geoStatus: "granted",
    requestLocation: vi.fn(),
    top5Pharmacies: [mockPharmacy],
    filteredPharmacies: [mockPharmacy],
    searchQuery: "",
    setSearchQuery: vi.fn(),
    selectedDistrict: "ALL",
    setSelectedDistrict: vi.fn(),
    allDistricts: ["Kampala", "Wakiso"],
    top5DrugShops: [],
    filteredDrugShops: [],
    dsSearchQuery: "",
    setDsSearchQuery: vi.fn(),
    dsSelectedDistrict: "ALL",
    setDsSelectedDistrict: vi.fn(),
    allDrugShopDistricts: [],
    selectedPharmacy: mockPharmacy,
    setSelectedPharmacy: mockSetSelectedPharmacy,
    route: {
      coordinates: [[32.58, 0.31], [32.585, 0.315]],
      distanceKm: 0.8,
      durationMinutes: 4,
      mode: "boda_boda",
    },
    isRouteLoading: false,
    transportMode: "boda_boda",
    setTransportMode: mockSetTransportMode,
  }),
}));

vi.mock("@/hooks/usePatientScope", () => ({
  usePatientScope: () => ({
    scopedMedicines: [],
    scopedReminders: [],
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe("PharmacyFinderModal - Full Screen Map View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both the section header and map canvas Full Screen buttons in normal view", () => {
    render(<PharmacyFinderModal onClose={vi.fn()} />);

    const headerFsBtn = screen.getByTitle("Resize map to full screen view");
    const mapFsBtn = screen.getByTitle("Full Screen Map");
    expect(headerFsBtn).toBeInTheDocument();
    expect(mapFsBtn).toBeInTheDocument();
  });

  it("toggles into fullscreen mode when clicking Full Screen button and displays Exit Full Screen", () => {
    render(<PharmacyFinderModal onClose={vi.fn()} />);

    const headerFsBtn = screen.getByTitle("Resize map to full screen view");
    fireEvent.click(headerFsBtn);

    // After clicking full screen, Exit Full Screen button appears in top bar
    const exitFsButtons = screen.getAllByRole("button", { name: /Exit Full Screen/i });
    expect(exitFsButtons.length).toBeGreaterThan(0);

    // Clicking Exit Full Screen reverts to normal view
    fireEvent.click(exitFsButtons[0]);
    expect(screen.getByTitle("Resize map to full screen view")).toBeInTheDocument();
  });

  it("renders floating bottom drawer with directions in fullscreen mode", () => {
    render(<PharmacyFinderModal onClose={vi.fn()} />);

    const headerFsBtn = screen.getByTitle("Resize map to full screen view");
    fireEvent.click(headerFsBtn);

    // Bottom drawer in fullscreen mode contains Directions button
    const directionsBtn = screen.getByRole("button", { name: /Directions/i });
    expect(directionsBtn).toBeInTheDocument();
  });

  it("exits fullscreen mode when pressing the Escape key", () => {
    const handleClose = vi.fn();
    render(<PharmacyFinderModal onClose={handleClose} />);

    // Enter fullscreen
    const headerFsBtn = screen.getByTitle("Resize map to full screen view");
    fireEvent.click(headerFsBtn);

    expect(screen.getAllByRole("button", { name: /Exit Full Screen/i }).length).toBeGreaterThan(0);

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });

    // Should exit fullscreen first, not close modal
    expect(handleClose).not.toHaveBeenCalled();
    expect(screen.getByTitle("Resize map to full screen view")).toBeInTheDocument();
  });
});
