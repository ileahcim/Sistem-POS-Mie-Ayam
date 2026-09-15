import type { Printer } from "./types";
import { MockPrinter } from "./printers/mock-printer";
import { RawBtPrinter } from "./printers/rawbt-printer";
import { WebBluetoothPrinter } from "./printers/web-bluetooth-printer";

export type PrinterDriver = "mock" | "rawbt" | "webbluetooth";

// Swapping the active driver never touches call sites — they only ever see
// the Printer interface. Until a real printer is confirmed working, every
// environment should stay on "mock".
export function getPrinter(driver: PrinterDriver = "mock"): Printer {
  switch (driver) {
    case "mock":
      return new MockPrinter();
    case "rawbt":
      return new RawBtPrinter();
    case "webbluetooth":
      return new WebBluetoothPrinter();
  }
}
