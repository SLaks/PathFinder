import React, { useState, useRef, useEffect, useCallback } from "react";
import { Box, Paper, rem } from "@mantine/core";

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

  // Physics state
  const velocity = useRef(0);
  const lastY = useRef<number | null>(null);
  const lastTime = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);
  const startHeight = useRef<number>(0);

  // Constants
  const FRICTION = 0.95;
  const VELOCITY_THRESHOLD = 0.1;

  const getWindowHeight = () => window.innerHeight;

  const getMaxHeightPixels = useCallback(() => {
    if (maxHeight.endsWith("vh")) {
      return (parseFloat(maxHeight) / 100) * getWindowHeight();
    } else if (maxHeight.endsWith("%")) {
      return (parseFloat(maxHeight) / 100) * getWindowHeight();
    } else if (maxHeight.endsWith("px")) {
      return parseFloat(maxHeight);
    }
    return getWindowHeight() * 0.9; // Default fallback
  }, [maxHeight]);

  const stopInertia = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
  };

  const handleTouchStart = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      stopInertia();
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      lastY.current = clientY;
      lastTime.current = performance.now();
      startHeight.current = height;
      velocity.current = 0;
      setIsDragging(true);
      e.preventDefault();
    },
    [height],
  );

  const onMove = useCallback(
    (e: TouchEvent | MouseEvent) => {
      if (lastY.current === null) return;
      const clientY =
        "touches" in e
          ? (e as TouchEvent).touches[0].clientY
          : (e as MouseEvent).clientY;
      const now = performance.now();
      const dt = now - lastTime.current;
      const dy = lastY.current - clientY; // Positive = dragging up

      if (dt > 0) {
        // Simple moving average for velocity could be smoother, but instantaneous is fine for simple flings
        velocity.current = dy / dt;
      }

      setHeight((prev) => {
        const maxPx = getMaxHeightPixels();
        const newH = Math.min(Math.max(prev + dy, minHeight), maxPx);
        return newH;
      });

      lastY.current = clientY;
      lastTime.current = now;
    },
    [minHeight, getMaxHeightPixels],
  );

  const inertiaLoop = useCallback(() => {
    if (Math.abs(velocity.current) < VELOCITY_THRESHOLD) {
      stopInertia();
      return;
    }

    setHeight((prev) => {
      const maxPx = getMaxHeightPixels();
      let newH = prev + velocity.current * 16; // Assume ~16ms per frame

      // Bounce or stop at edges? Let's stop.
      if (newH < minHeight) {
        newH = minHeight;
        velocity.current = 0;
      } else if (newH > maxPx) {
        newH = maxPx;
        velocity.current = 0;
      }

      return newH;
    });

    velocity.current *= FRICTION;
    animationFrameId.current = requestAnimationFrame(inertiaLoop);
  }, [minHeight, getMaxHeightPixels]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    lastY.current = null;

    // Start inertia if moving fast enough
    if (Math.abs(velocity.current) > VELOCITY_THRESHOLD) {
      inertiaLoop();
    }
  }, [inertiaLoop]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend", handleTouchEnd);
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", handleTouchEnd);
    } else {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", handleTouchEnd);
    }
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", handleTouchEnd);
      stopInertia();
    };
  }, [isDragging, onMove, handleTouchEnd]);

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
        transition: isDragging ? "none" : "height 0.1s linear",
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
