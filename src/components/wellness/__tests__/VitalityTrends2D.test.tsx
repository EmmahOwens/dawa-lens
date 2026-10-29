import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VitalityTrends2D } from "../VitalityTrends2D";

describe("VitalityTrends2D", () => {
  const mockData = [
    { name: "Day 1", adherence: 100, energy: 60, mood: 80 },
    { name: "Day 2", adherence: 75, energy: 40, mood: 100 },
    { name: "Day 3", adherence: 50, energy: 20, mood: 20 },
    { name: "Day 4", adherence: 100, energy: null, mood: null },
    { name: "Day 5", adherence: 100, energy: 80, mood: 60 },
    { name: "Day 6", adherence: 100, energy: 100, mood: 80 },
    { name: "Day 7", adherence: 100, energy: 60, mood: 100 },
  ];

  it("renders the 1★ to 5★ right axis labels matching discrete rating values", () => {
    render(<VitalityTrends2D data={mockData} />);
    expect(screen.getByText("1★")).toBeInTheDocument();
    expect(screen.getByText("2★")).toBeInTheDocument();
    expect(screen.getByText("3★")).toBeInTheDocument();
    expect(screen.getByText("4★")).toBeInTheDocument();
    expect(screen.getByText("5★")).toBeInTheDocument();
  });

  it("renders adherence grid lines 0%, 25%, 50%, 75%, 100%", () => {
    render(<VitalityTrends2D data={mockData} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders legend pills for toggling lines", () => {
    render(<VitalityTrends2D data={mockData} />);
    expect(screen.getByRole("button", { name: /adherence/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /energy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mood/i })).toBeInTheDocument();
  });
});
