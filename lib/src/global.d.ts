import Chya from "./chya";

export {};

declare global {
  interface Window {
    Chya: Chya;
  }
}
