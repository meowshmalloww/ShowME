import type { ShowMEApi } from "../../shared/ipc";

declare global {
  interface Window {
    showme: ShowMEApi;
  }
}
