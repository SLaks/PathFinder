import React from "react";
import { Timeline, Text, Box, Group } from "@mantine/core";
import Icon from "@mdi/react";
import { HereAction } from "../../services/hereService";
import { getActionIcon, formatActionTitle, formatDistance, formatDuration } from "./SidebarUtils";

interface SidebarDirectionsPanelProps {
  routeActions: HereAction[];
  onHoverAction: (action: HereAction | null) => void;
}

export const SidebarDirectionsPanel: React.FC<SidebarDirectionsPanelProps> = ({
  routeActions,
  onHoverAction,
}) => (
  routeActions.length === 0 ? (
    <Text c="dimmed" size="sm" ta="center" mt="xl">
      Optimize a route to see turn-by-turn directions.
    </Text>
  ) : (
    <Timeline active={-1} bulletSize={32} lineWidth={2}>
      {routeActions.map((action, index) => {
        const IconPath = getActionIcon(action);
        return (
          <Timeline.Item
            key={index}
            title={
              <Text fw={600} size="sm">
                {formatActionTitle(action)}
              </Text>
            }
            bullet={
              <Box
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: "var(--mantine-color-emerald-6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Icon path={IconPath} size={0.7} color="white" />
              </Box>
            }
          >
            <Box
              onMouseEnter={() => onHoverAction(action)}
              onMouseLeave={() => onHoverAction(null)}
              style={{ cursor: "pointer" }}
            >
              <Text
                size="sm"
                dangerouslySetInnerHTML={{ __html: action.instruction }}
              />
              <Group gap="xs" mt={4}>
                <Text size="xs" c="dimmed" fw={500}>
                  {formatDistance(action.length)}
                </Text>
                <Text size="xs" c="dimmed">•</Text>
                <Text size="xs" c="dimmed" fw={500}>
                  {formatDuration(action.duration)}
                </Text>
              </Group>
            </Box>
          </Timeline.Item>
        );
      })}
    </Timeline>
  )
);
