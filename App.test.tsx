import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import App from "./App";
import * as storageService from "./services/storageService";
import * as locationService from "./services/locationService";
import * as routeService from "./services/routeService";
import * as addressService from "./services/addressService";
import { SidebarProps } from "./components/Sidebar";
import { theme } from "./theme";

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
  // Add this mock to prevent errors
  geocodeAddress: vi.fn(),
}));
vi.mock("./services/routeService", () => ({
  optimizeRoute: vi.fn(),
}));
vi.mock("./services/addressService", () => ({
  separateAddressesByStatus: vi.fn(),
}));

const renderWithMantine = (ui: React.ReactNode) => {
  return act(() =>
    render(<MantineProvider theme={theme}>{ui}</MantineProvider>),
  );
};

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

  it("should show API key modal if no key is stored", async () => {
    vi.mocked(storageService.getHereApiKey).mockReturnValue(null);
    renderWithMantine(<App />);
    console.log(document.body.innerHTML);
    expect(
      await screen.findByText("Enter HERE Maps API Key"),
    ).toBeInTheDocument();
  });

  it("should not show API key modal if key is stored", () => {
    vi.mocked(storageService.getHereApiKey).mockReturnValue("test-key");
    renderWithMantine(<App />);
    expect(
      screen.queryByText("Enter HERE Maps API Key"),
    ).not.toBeInTheDocument();
  });

  it("should fetch user location on mount", async () => {
    renderWithMantine(<App />);
    await waitFor(() => {
      expect(locationService.getUserLocation).toHaveBeenCalled();
    });
  });

  it("should handle API key submission", async () => {
    vi.mocked(storageService.getHereApiKey).mockReturnValue(null);
    renderWithMantine(<App />);

    act(() => {
      const input = screen.getByPlaceholderText("Paste your API Key here");
      fireEvent.change(input, { target: { value: "new-key" } });

      const button = screen.getByText("Start App");
      fireEvent.click(button);
    });

    expect(storageService.setHereApiKey).toHaveBeenCalledWith("new-key");
    await waitFor(() => {
      expect(
        screen.queryByText("Enter HERE Maps API Key"),
      ).not.toBeInTheDocument();
    });
  });

  it("should handle route optimization", async () => {
    vi.mocked(storageService.getHereApiKey).mockReturnValue("test-key");
    vi.mocked(routeService.optimizeRoute).mockResolvedValue({
      sortedAddresses: [],
      routeShape: ["shape"],
    });

    renderWithMantine(<App />);

    // Wait for location to be loaded (Waiting for location... should disappear)
    await waitFor(() => {
      expect(
        screen.queryByText("Waiting for location..."),
      ).not.toBeInTheDocument();
    });

    // Add address to enable optimization (mock sidebar logic)
    act(() => {
      const addBtn = screen.getByText("Add Address");
      fireEvent.click(addBtn);

      const optimizeBtn = screen.getByText("Optimize");
      fireEvent.click(optimizeBtn);
    });

    await waitFor(() => {
      expect(routeService.optimizeRoute).toHaveBeenCalled();
    });
  });
});
