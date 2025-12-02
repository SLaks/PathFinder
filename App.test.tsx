import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import * as storageService from "./services/storageService";
import * as locationService from "./services/locationService";
import * as routeService from "./services/routeService";
import * as addressService from "./services/addressService";
import { SidebarProps } from "./components/Sidebar";

// Mock components
vi.mock("./components/HereMap", () => ({
  default: () => <div data-testid="here-map">HereMap</div>,
}));
vi.mock("./components/Sidebar", () => ({
  default: ({ onOptimize, setAddresses }: SidebarProps) => (
    <div data-testid="sidebar">
      <button onClick={onOptimize}>Optimize</button>
      <button onClick={() => setAddresses([{ id: "1", originalText: "Test" }])}>
        Add Address
      </button>
    </div>
  ),
}));

// Mock services
vi.mock("./services/storageService", () => ({
  getHereApiKey: vi.fn(),
  setHereApiKey: vi.fn(),
  removeHereApiKey: vi.fn(),
}));
vi.mock("./services/locationService", () => ({
  getUserLocation: vi.fn(),
  geocodeAddresses: vi.fn(),
}));
vi.mock("./services/routeService", () => ({
  optimizeRoute: vi.fn(),
}));
vi.mock("./services/addressService", () => ({
  separateAddressesByStatus: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(locationService.getUserLocation).mockResolvedValue({
      lat: 0,
      lng: 0,
    });
    vi.mocked(addressService.separateAddressesByStatus).mockReturnValue({
      active: [],
      completed: [],
    });
  });

  it("should show API key modal if no key is stored", () => {
    vi.mocked(storageService.getHereApiKey).mockReturnValue(null);
    render(<App />);
    expect(screen.getByText("Enter HERE Maps API Key")).toBeInTheDocument();
  });

  it("should not show API key modal if key is stored", () => {
    vi.mocked(storageService.getHereApiKey).mockReturnValue("test-key");
    render(<App />);
    expect(
      screen.queryByText("Enter HERE Maps API Key"),
    ).not.toBeInTheDocument();
  });

  it("should fetch user location on mount", async () => {
    render(<App />);
    await waitFor(() => {
      expect(locationService.getUserLocation).toHaveBeenCalled();
    });
  });

  it("should handle API key submission", async () => {
    vi.mocked(storageService.getHereApiKey).mockReturnValue(null);
    render(<App />);

    const input = screen.getByPlaceholderText("Paste your API Key here");
    fireEvent.change(input, { target: { value: "new-key" } });

    // Simulate Enter key or button click. The mock implementation of the button uses previousElementSibling
    // which might be tricky with testing-library. Let's try the button click.
    const button = screen.getByText("Start App");
    fireEvent.click(button);

    expect(storageService.setHereApiKey).toHaveBeenCalledWith("new-key");
    expect(
      screen.queryByText("Enter HERE Maps API Key"),
    ).not.toBeInTheDocument();
  });

  it("should switch mobile tabs", () => {
    render(<App />);

    // Default is list
    const sidebarContainer = screen.getByTestId("sidebar").parentElement;
    expect(sidebarContainer).not.toHaveClass("hidden");

    // Switch to map
    const mapTab = screen.getByText("Map");
    fireEvent.click(mapTab);

    // Sidebar should be hidden on mobile (md:block ensures it's visible on desktop, but we check class logic)
    // The class logic is: mobileTab === "list" ? "block" : "hidden md:block"
    // So if map is selected, it should be "hidden md:block"
    expect(sidebarContainer).toHaveClass("hidden");
  });

  it("should handle route optimization", async () => {
    vi.mocked(storageService.getHereApiKey).mockReturnValue("test-key");
    vi.mocked(routeService.optimizeRoute).mockResolvedValue({
      sortedAddresses: [],
      routeShape: ["shape"],
    });

    render(<App />);

    // Wait for location to be loaded (Waiting for location... should disappear)
    await waitFor(() => {
      expect(
        screen.queryByText("Waiting for location..."),
      ).not.toBeInTheDocument();
    });

    // Add address to enable optimization (mock sidebar logic)
    const addBtn = screen.getByText("Add Address");
    fireEvent.click(addBtn);

    const optimizeBtn = screen.getByText("Optimize");
    fireEvent.click(optimizeBtn);

    await waitFor(() => {
      expect(routeService.optimizeRoute).toHaveBeenCalled();
    });
  });
});
