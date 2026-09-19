import type { Printer, PrinterDriver } from "./types";
import { MockPrinter } from "./printers/mock-printer";
import { rawBtPrinter } from "./printers/rawbt-printer";
import { webBluetoothPrinter } from "./printers/web-bluetooth-printer";

// Web Bluetooth is the default driver: it prints from Chrome on the POS
// tablet without an instant-app and with no RawBT watermark on the receipt
// (both flow through the same escpos.ts byte payload). "rawbt" is the
// fallback for iPhones/Safari or a BLE-serial-unfriendly ECO80D, and "mock"
// shows the on-screen preview (print-preview page, Tes Printer).
export function getPrinter(driver: PrinterDriver = "webbluetooth"): Printer {
  switch (driver) {
    case "mock":
      return new MockPrinter();
    case "rawbt":
      return rawBtPrinter;
    case "webbluetooth":
      return webBluetoothPrinter;
  }
}