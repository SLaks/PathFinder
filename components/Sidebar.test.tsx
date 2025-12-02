import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Sidebar from "./Sidebar";
import { Address } from "../types";
import * as addressService from "../services/addressService";
import { AddressCardProps } from "./AddressCard";

// Mock services
vi.mock("../services/addressService", () => ({
  parseAddressesFromText: vi.fn(),
}));
vi.mock("../services/storageService", () => ({
  getSheetConfig: vi.fn(),
  setSheetConfig: vi.fn(),
}));
vi.mock("../services/sheetIntegrationService", () => ({
  initializeGoogleSheets: vi.fn(),
}));
vi.mock("../services/routeService", () => ({
  createGoogleMapsNavigationLink: vi.fn(),
}));

// Mock AddressCard to simplify testing
vi.mock("./AddressCard", () => ({
  AddressCard: ({ address, onClick }: AddressCardProps) => (
    <div data-testid="address-card" onClick={onClick}>
      {address.originalText}
    </div>
  ),
}));

describe("Sidebar", () => {
  const defaultProps = {
    addresses: [],
    setAddresses: vi.fn(),
    onOptimize: vi.fn(),
    isOptimizing: false,
    isGeocoding: false,
    userLocation: { lat: 0, lng: 0 },
    onResetKey: vi.fn(),
    onFocusAddress: vi.fn(),
    onHoverAddress: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render correctly", () => {
    render(<Sidebar {...defaultProps} />);
    expect(screen.getByText("RouteOptima")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Paste addresses here/),
    ).toBeInTheDocument();
  });

  it("should handle text input and parsing", async () => {
    const mockAddresses = [{ id: "1", originalText: "123 Main St" }];
    vi.mocked(addressService.parseAddressesFromText).mockResolvedValue(
      mockAddresses,
    );

    render(<Sidebar {...defaultProps} />);

    const input = screen.getByPlaceholderText(/Paste addresses here/);
    fireEvent.change(input, { target: { value: "123 Main St" } });

    const parseButton = screen.getByText("Parse Text");
    fireEvent.click(parseButton);

    await waitFor(() => {
      expect(addressService.parseAddressesFromText).toHaveBeenCalledWith(
        "123 Main St",
      );
      expect(defaultProps.setAddresses).toHaveBeenCalledWith(mockAddresses);
    });
  });

  it("should disable optimize button when not ready", () => {
    render(<Sidebar {...defaultProps} addresses={[]} />);
    const button = screen.getByText("Optimize Route");
    expect(button).toBeDisabled();
  });

  it("should enable optimize button when ready", () => {
    const addresses = [
      { id: "1", originalText: "A" },
      { id: "2", originalText: "B" },
    ] as Address[];
    render(<Sidebar {...defaultProps} addresses={addresses} />);
    const button = screen.getByText("Optimize Route");
    expect(button).not.toBeDisabled();
  });

  it("should call onOptimize when optimize button is clicked", () => {
    const addresses = [
      { id: "1", originalText: "A" },
      { id: "2", originalText: "B" },
    ] as Address[];
    render(<Sidebar {...defaultProps} addresses={addresses} />);

    const button = screen.getByText("Optimize Route");
    fireEvent.click(button);
    expect(defaultProps.onOptimize).toHaveBeenCalled();
  });

  it("should render address list", () => {
    const addresses = [
      { id: "1", originalText: "Address 1" },
      { id: "2", originalText: "Address 2" },
    ] as Address[];
    render(<Sidebar {...defaultProps} addresses={addresses} />);

    expect(screen.getAllByTestId("address-card")).toHaveLength(2);
    expect(screen.getByText("Address 1")).toBeInTheDocument();
  });

  it("should call onFocusAddress when address is clicked", () => {
    const addresses = [{ id: "1", originalText: "Address 1" }] as Address[];
    render(<Sidebar {...defaultProps} addresses={addresses} />);

    const card = screen.getByTestId("address-card");
    fireEvent.click(card);
    expect(defaultProps.onFocusAddress).toHaveBeenCalledWith("1");
  });
});
