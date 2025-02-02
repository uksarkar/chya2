export * from "./dist";
import Chya from "./dist/chya";

declare global {
  interface Window {
    Chya: Chya;
  }
}
