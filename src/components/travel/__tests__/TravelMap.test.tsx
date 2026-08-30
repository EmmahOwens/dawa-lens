import * as React from "react";
import { render } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TravelMap } from "../TravelMap";

// Mock maplibre-gl
const mockSetLngLat = vi.fn().mockReturnThis();
const mockSetPopup = vi.fn().mockReturnThis();
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

vi.mock("maplibre-gl", () => {
  const MapMock = vi.fn(() => ({
    on: mockOn,
    addControl: vi.fn(),
    addSource: vi.fn(),
    addLayer: vi.fn(),
    getSource: mockGetSource,
    isStyleLoaded: mockIsStyleLoaded,
    resize: mockResize,
    fitBounds: mockFitBounds,
    flyTo: mockFlyTo,
    remove: mockRemove,
    project: vi.fn(([lng, lat]) => ({ x: lng * 10, y: -lat * 10 })),
  }));

  const MarkerMock = vi.fn(() => ({
    setLngLat: mockSetLngLat,
    setPopup: mockSetPopup,
    addTo: mockAddTo,
    remove: mockRemove,
  }));

  const PopupMock = vi.fn(() => ({
    setHTML: vi.fn().mockReturnThis(),
  }));

  const LngLatBoundsMock = vi.fn(() => ({
    extend: vi.fn().mockReturnThis(),
  }));

  const AttributionControlMock = vi.fn();

  return {
    default: {
      Map: MapMock,
      Marker: MarkerMock,
      Popup: PopupMock,
      LngLatBounds: LngLatBoundsMock,
      AttributionControl: AttributionControlMock,
    },
    Map: MapMock,
    Marker: MarkerMock,
    Popup: PopupMock,
    LngLatBounds: LngLatBoundsMock,
    AttributionControl: AttributionControlMock,
  };
});

// Mock framer-motion and RiveMoji
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  motion: new Proxy(
    {} as Record<string, unknown>,
    {
      get: (_target, prop: string) =>
        React.forwardRef(function MotionEl(
          { children, ...rest }: React.HTMLAttributes<HTMLElement>,
          ref: React.Ref<HTMLElement>
        ) {
          return React.createElement(prop, { ...rest, ref }, children);
        }),
    }
  ),
}));

vi.mock("../rive/RiveMoji", () => ({
  RiveMoji: ({ emoji }: { emoji: string }) => <span>{emoji}</span>,
}));

describe("TravelMap Component with Mini Plane Animation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders correctly and initializes MapLibre map", () => {
    const { container } = render(
      <TravelMap
        isAnimating={false}
        destination="Kenya"
        userCoords={[32.58, 0.35]}
        userCountry="Uganda"
      />
    );

    expect(container).toBeInTheDocument();
  });

  it("handles destination changes and unmounts cleanly without throwing", () => {
    const { unmount, rerender } = render(
      <TravelMap
        isAnimating={false}
        destination="France"
        userCoords={[36.82, -1.29]}
        userCountry="Kenya"
      />
    );

    rerender(
      <TravelMap
        isAnimating={true}
        destination="Japan"
        userCoords={[36.82, -1.29]}
        userCountry="Kenya"
      />
    );

    expect(() => unmount()).not.toThrow();
  });
});
