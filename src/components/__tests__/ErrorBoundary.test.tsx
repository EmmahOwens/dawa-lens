import * as React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ErrorBoundary from "../ErrorBoundary";

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

const ThrowError: React.FC<{ errorToThrow: Error }> = ({ errorToThrow }) => {
  throw errorToThrow;
};

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Suppress console.error in tests for expected thrown errors
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders 'New Version Available' when 'reading default' error occurs", () => {
    const error = new TypeError("Cannot read properties of undefined (reading 'default')");

    render(
      <ErrorBoundary name="TestBoundary">
        <ThrowError errorToThrow={error} />
      </ErrorBoundary>
    );

    // Verify title and content reflect chunk/deployment error instead of generic crash
    expect(screen.getByText("New Version Available")).toBeTruthy();
    expect(screen.getByText(/A fresh update of Dawa Lens was just deployed/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /update & reload/i })).toBeTruthy();
  });

  it("renders 'Something went wrong' for non-chunk standard errors", () => {
    const error = new Error("General calculation failed");

    render(
      <ErrorBoundary name="TestBoundary">
        <ThrowError errorToThrow={error} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(screen.getByText("General calculation failed")).toBeTruthy();
    expect(screen.getByRole("button", { name: /reload application/i })).toBeTruthy();
  });
});
