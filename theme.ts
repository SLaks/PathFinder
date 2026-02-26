import { createTheme, MantineColorsTuple } from "@mantine/core";

const emerald: MantineColorsTuple = [
  "#eaf8f1",
  "#d0eedf",
  "#b2e3cc",
  "#91d7b6",
  "#6aca9f",
  "#42bc86",
  "#1c8a5c",
  "#137149",
  "#0d5636",
  "#084127",
];

const gold: MantineColorsTuple = [
  "#fbfaf7",
  "#f5f1e8",
  "#ede6d5",
  "#e3d9bf",
  "#d8caa6",
  "#cbb98a",
  "#c4b592",
  "#a29472",
  "#817559",
  "#625943",
];

export const theme = createTheme({
  primaryColor: "emerald",
  defaultRadius: "md",

  // Enhance colors for better dark mode support
  colors: {
    emerald,
    gold,
    dark: [
      "#C1C2C5",
      "#A6A7AB",
      "#909296",
      "#5c5f66",
      "#373A40",
      "#2C2E33",
      "#25262b",
      "#1A1B1E",
      "#141517",
      "#101113",
    ],
  },

  // Customize component defaults for dark mode
  components: {
    Paper: {
      defaultProps: {
        shadow: "sm",
      },
    },
  },
});
