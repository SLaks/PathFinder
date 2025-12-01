import React from "react";
import { Address } from "../types";
import { getAddressColor } from "../utils/colors";
import { getInitials } from "../utils/formatters";

interface AddressCardProps {
  address: Address;
  index: number;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  className?: string;
  isCompact?: boolean; // For map bubble
}

export const AddressCard: React.FC<AddressCardProps> = ({
  address,
  index,
  onClick,
  onMouseEnter,
  onMouseLeave,
  className = "",
  isCompact = false,
}) => {
  const color = getAddressColor(index);
  const initials = getInitials(address.name || address.originalText);
  const isLoading = address.isGeocoding;
  const isError = !address.location && !address.isGeocoding;

  let containerClass = `rounded-lg border flex gap-3 items-start transition-all ${className}`;

  if (onClick) containerClass += " cursor-pointer";

  if (isError) {
    containerClass += " bg-red-50 border-red-100";
  } else if (isLoading) {
    containerClass += " bg-blue-50 border-blue-100";
  } else {
    containerClass += " bg-white border-gray-200 hover:border-blue-300";
  }

  // Override for compact map bubble
  if (isCompact) {
    containerClass = "flex gap-3 items-start min-w-[200px]";
  }

  return (
    <div
      className={containerClass}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Avatar / Initials */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
        style={{ backgroundColor: isLoading ? "#cbd5e1" : color }}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400">
            #{address.sequenceOrder ?? index + 1}
          </span>
          {address.name && (
            <p className="text-gray-900 font-bold truncate text-sm">
              {address.name}
            </p>
          )}
        </div>

        <p
          className={`${
            address.name
              ? "text-gray-500 text-xs"
              : "text-gray-900 font-medium text-sm"
          } line-clamp-2`}
        >
          {address.formattedAddress || address.originalText}
        </p>

        {isLoading && (
          <p className="text-xs text-blue-600 mt-0.5">Finding location...</p>
        )}
        {isError && (
          <p className="text-xs text-red-500 mt-0.5">Location not found</p>
        )}
      </div>
    </div>
  );
};
