import React, { useState, useRef, useEffect, useEffectEvent } from "react";
import { Box, Paper, rem } from "@mantine/core";
import { useMove } from "@mantine/hooks";

interface BottomSheetProps {
  children: React.ReactNode;
  minHeight?: number; // Height in pixels when collapsed
  maxHeight?: string; // CSS height when expanded (e.g. "90vh")
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  children,
  minHeight = 24,
  maxHeight = "90vh",
}) => {
  const [height, setHeight] = useState(minHeight);
  const [isDragging, setIsDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Use Mantine's useMove to handle drag gestures
  const { ref: dragHandleRef, active } = useMove(({ y }) => {
    // y is between 0 and 1 relative to the container
    // But we want absolute pixel movement.
    // Since useMove is a bit tricky for this specific "drag up from bottom" case
    // without a fixed container size, let's try a simpler touch event approach first
    // or adapt useMove.
    // Actually, let's use standard touch events for better control over the sheet behavior.
  });

  // Custom touch handling
  const startY = useRef<number | null>(null);
  const startHeight = useRef<number>(0);

  const handleTouchStart = useEffectEvent(
    (e: React.TouchEvent | React.MouseEvent) => {
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      startY.current = clientY;
      startHeight.current = height;
      setIsDragging(true);
      e.preventDefault();
    },
  );

  const handleTouchMove = useEffectEvent((e: TouchEvent | MouseEvent) => {
    if (startY.current === null) return;
    const clientY =
      "touches" in e
        ? (e as TouchEvent).touches[0].clientY
        : (e as MouseEvent).clientY;
    const deltaY = startY.current - clientY; // Positive when dragging up
    const newHeight = Math.max(minHeight, startHeight.current + deltaY);

    // Simple constraint: don't exceed window height roughly
    // We can refine this with the passed maxHeight
    setHeight(newHeight);
  });

  const handleTouchEnd = useEffectEvent(() => {
    startY.current = null;
    setIsDragging(false);

    // Snap logic
    const windowHeight = window.innerHeight;

    if (height > windowHeight * 0.75) {
      // Expand
      setHeight(windowHeight * 0.9);
    } else if (height < windowHeight * 0.25) {
      // Collapse
      setHeight(minHeight);
    } else {
      // Don't snap; just keep the current height.
    }
  });

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("touchmove", handleTouchMove);
      window.addEventListener("touchend", handleTouchEnd);
      window.addEventListener("mousemove", handleTouchMove);
      window.addEventListener("mouseup", handleTouchEnd);
    } else {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("mousemove", handleTouchMove);
      window.removeEventListener("mouseup", handleTouchEnd);
    }
    return () => {
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("mousemove", handleTouchMove);
      window.removeEventListener("mouseup", handleTouchEnd);
    };
  }, [isDragging]);

  return (
    <Paper
      shadow="xl"
      radius="md"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: height,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        transition: isDragging ? "none" : "height 0.3s ease-out",
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        overflow: "hidden",
      }}
    >
      {/* Drag Handle */}
      <Box
        onMouseDown={handleTouchStart}
        onTouchStart={handleTouchStart}
        style={{
          padding: rem(10),
          cursor: "grab",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          background: "var(--mantine-color-body)",
          borderBottom: "1px solid var(--mantine-color-default-border)",
          flexShrink: 0,
          touchAction: "none", // Prevent scrolling while dragging handle
        }}
      >
        <Box
          style={{
            width: 40,
            height: 4,
            borderRadius: 2,
            backgroundColor: "var(--mantine-color-gray-4)",
          }}
        />
      </Box>

      {/* Content */}
      <Box
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {children}
      </Box>
    </Paper>
  );
};
