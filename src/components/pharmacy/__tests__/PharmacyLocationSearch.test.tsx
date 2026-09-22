import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PharmacyLocationSearch } from "../PharmacyLocationSearch";
import * as geocodingService from "@/services/locationGeocodingService";

describe("PharmacyLocationSearch", () => {
  const mockCurrentCoords: [number, number] = [32.5825, 0.3476];
  const mockOnSelectPlace = vi.fn();
  const mockOnResetToGps = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders search input with placeholder and provider badge", () => {
    render(
      <PharmacyLocationSearch
        currentCoords={mockCurrentCoords}
        activeLocationLabel="Device GPS Location"
        isCustomLocation={false}
        onSelectPlace={mockOnSelectPlace}
        onResetToGps={mockOnResetToGps}
      />
    );

    expect(screen.getByPlaceholderText(/Search town, neighborhood/i)).toBeInTheDocument();
    expect(screen.getByText("Photon")).toBeInTheDocument();
  });

  it("searches and renders instant drop-down suggestions when typing", async () => {
    const mockPlaces: geocodingService.GeocodedPlace[] = [
      {
        id: "photon-1",
        name: "Ntinda",
        displayName: "Ntinda, Nakawa, Kampala, Uganda",
        coordinates: [32.6136, 0.3544],
        type: "suburb",
        provider: "photon",
      },
      {
        id: "photon-2",
        name: "Kololo",
        displayName: "Kololo, Kampala, Uganda",
        coordinates: [32.5933, 0.3344],
        type: "suburb",
        provider: "photon",
      },
    ];

    vi.spyOn(geocodingService, "searchAddressSuggestions").mockResolvedValue(mockPlaces);

    render(
      <PharmacyLocationSearch
        currentCoords={mockCurrentCoords}
        activeLocationLabel="Device GPS Location"
        isCustomLocation={false}
        onSelectPlace={mockOnSelectPlace}
        onResetToGps={mockOnResetToGps}
      />
    );

    const input = screen.getByPlaceholderText(/Search town, neighborhood/i);
    fireEvent.change(input, { target: { value: "Ntinda" } });

    await waitFor(() => {
      expect(screen.getByText("Ntinda")).toBeInTheDocument();
      expect(screen.getByText("Ntinda, Nakawa, Kampala, Uganda")).toBeInTheDocument();
    });

    // Clicking a suggestion triggers onSelectPlace
    fireEvent.click(screen.getByText("Ntinda"));
    expect(mockOnSelectPlace).toHaveBeenCalledWith(mockPlaces[0]);
  });

  it("shows active custom location badge and allows resetting to GPS", () => {
    render(
      <PharmacyLocationSearch
        currentCoords={[32.6136, 0.3544]}
        activeLocationLabel="Ntinda, Kampala"
        isCustomLocation={true}
        onSelectPlace={mockOnSelectPlace}
        onResetToGps={mockOnResetToGps}
      />
    );

    expect(screen.getByText("Near:")).toBeInTheDocument();
    expect(screen.getByText("Ntinda, Kampala")).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: /use my gps/i });
    fireEvent.click(resetBtn);
    expect(mockOnResetToGps).toHaveBeenCalledTimes(1);
  });
});
