/// <reference types="vite/client" />

declare module "@icons-pack/react-simple-icons/icons/*.mjs" {
  import type { ComponentType, SVGProps } from "react";

  const icon: ComponentType<SVGProps<SVGSVGElement> & { size?: string | number }>;
  export default icon;
}
