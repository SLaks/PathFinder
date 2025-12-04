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

  it("should show API key modal if no key is stored", () => {
    vi.mocked(storageService.getHereApiKey).mockReturnValue(null);
    renderWithMantine(<App />);
    expect(screen.getByText("Enter HERE Maps API Key")).toBeInTheDocument();
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

  it("should switch mobile tabs", async () => {
    renderWithMantine(<App />);

    // Default is list
    const sidebar = screen.getByTestId("sidebar");
    // In Mantine, we check if the parent Box is visible.
    // The Sidebar is wrapped in a Box with display logic.
    // Since we can't easily check computed styles in jsdom without better mocks,
    // we can check if the Map tab button switches the state.
    // However, checking visibility in jsdom is tricky with Mantine's responsive styles.
    // We'll trust the state change logic for now or check if the element exists.

    // Switch to map
    act(() => {
      const mapTab = screen.getByText("Map");
      fireEvent.click(mapTab);
    });

    // We can check if the map container is now visible or if the sidebar is hidden.
    // With Mantine, 'hiddenFrom' or 'display' props are used.
    // Let's just verify the tab click doesn't crash and potentially check for style attributes if possible,
    // but given the complexity of Mantine styles in tests, we might skip strict style checks here
    // unless we inspect the style prop directly.

    // Let's check if the sidebar parent has display: none (which we set in App.tsx)
    // <Box display={{ base: mobileTab === "list" ? "block" : "none", md: "block" }}>
    // When map is selected, mobileTab is 'map', so base should be 'none'.

    // We need to find the parent of the sidebar.
    const sidebarParent = sidebar.parentElement;
    // Note: Mantine might add intermediate divs.
    // Let's assume the immediate parent is the Box we added.

    // Actually, checking style prop on the element might work if it was passed as inline style.
    // In App.tsx we used: display={{ base: mobileTab === "list" ? "block" : "none", md: "block" }}
    // Mantine converts this to classes or styles.
    // If we used `style={{ display: ... }}` it would be easier.
    // In App.tsx I used:
    // style={{
    //   display: mobileTab === "list" ? "block" : "none",
    //   zIndex: 20,
    // }}
    // So we CAN check this inline style!

    expect(sidebarParent).toHaveStyle({ display: "none" });
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
