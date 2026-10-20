import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { DawaGPTOfflineModal } from "../DawaGPTOfflineModal";

const mockedNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockedNavigate,
  };
});

describe("DawaGPTOfflineModal Component", () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when isOpen is true with offline explanation", () => {
    render(
      <BrowserRouter>
        <DawaGPTOfflineModal {...defaultProps} />
      </BrowserRouter>
    );

    expect(screen.getByText("DawaGPT is Offline")).toBeInTheDocument();
    expect(
      screen.getByText(/Internet connection required for conversational AI/i)
    ).toBeInTheDocument();
  });

  it("renders all 11 system features as quick action cards", () => {
    render(
      <BrowserRouter>
        <DawaGPTOfflineModal {...defaultProps} />
      </BrowserRouter>
    );

    const featureNames = [
      "My Medications",
      "Safety Check",
      "Med Vault",
      "Reminders",
      "Quick Scan",
      "Dose History",
      "Family Hub",
      "Wellness Hub",
      "Travel Companion",
      "Care Report",
      "Settings",
    ];

    featureNames.forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
  });

  it("navigates to the feature path and closes the modal on click", () => {
    render(
      <BrowserRouter>
        <DawaGPTOfflineModal {...defaultProps} />
      </BrowserRouter>
    );

    const medVaultCard = screen.getByText("Med Vault");
    fireEvent.click(medVaultCard);

    expect(mockedNavigate).toHaveBeenCalledWith("/medvault");
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it("does not render modal contents when isOpen is false", () => {
    render(
      <BrowserRouter>
        <DawaGPTOfflineModal isOpen={false} onClose={vi.fn()} />
      </BrowserRouter>
    );

    expect(screen.queryByText("DawaGPT requires internet")).not.toBeInTheDocument();
  });
});
