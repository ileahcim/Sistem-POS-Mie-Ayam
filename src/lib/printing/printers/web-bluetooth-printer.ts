// Web Bluetooth print driver — the primary printer path for the Blueprint
// ECO80D (see CLAUDE.md "Struk & printer"). Prints straight out of Chrome
// on the POS tablet over the Bluetooth Low Energy variant of the printer's
// (seller-confirmed) Bluetooth 2.0 + BLE 5.0 stack, so no instant-app is
// needed and no RawBT footer/watermark appears on the receipt.
//
// Hard limits that shape this design:
//  - navigator.bluetooth.requestDevice() needs a user gesture, so explicit
//    pairing happens once from Pengaturan ("Hubungkan Bluetooth"). After
//    that, the device ID + GATT attribute UUIDs are kept in localStorage
//    and reconnect is done via navigator.bluetooth.getDevices() — silent on
//    subsequent prints, including the auto-print right after pembayaran.
//  - The ECO80B/ECO80D does not expose a common service UUID, and the
//    BLE-enabled ones use arbitrary vendor serial services. Therefore we
//    accept ALL devices in the chooser and probe a small list of well-known
//    BLE-serial/thermal service UUIDs for the first writable characteristic,
//    falling back to a full service scan for homebrew firmwares. Whatever
//    the user picks in the chooser, we only write to a characteristic that
//    actually advertises write / write-without-response.
//  - iOS Safari does not ship the Web Bluetooth API at all; isSupported()
//    covers that (the tablet here is Android-native Chrome anyway).
//  - GATT writes are capped at 512 bytes per frame; long receipts are sent
//    in ≤512-byte chunks with a gap in between (see writeChunked).
//
// Every path answers honestly: an async success or a plain-language
// Indonesian error string, never a throw. Printers are transport pipes and
// a failed print must never block a completed order.

import type { PackingListData, Printer, PrintResult, ReceiptData } from "../types";
import { buildPackingListBytes, buildReceiptBytes } from "../escpos";
import { withLogo } from "../logo-raster";

// Well-known BLE serial / ESC-POS-over-BLE service UUIDs to probe first.
// 0xFF00 is the most common one on cheap thermal printers; 0xFFE0 is the
// classic HM-10 transparent-UART service, and 0x18F0 is the newer
// "vendor-specific" convention used by well-developed ones like the ECO80D's
// firmware family.
const KNOWN_SERVICE_UUIDS = [
  "0000ff00-0000-1000-8000-00805f9b34fb", // 0xFF00 vendor UART service
  "0000ffe0-0000-1000-8000-00805f9b34fb", // 0xFFE0 HM-10 style UART service
  "000018f0-0000-1000-8000-00805f9b34fb", // 0x18F0 vendor serial service
];

const STORAGE_KEY = "pos.printer.webbluetooth.v1";

// Dispatched after (re)pairing/forgetting so the settings screen (which
// subscribes via useSyncExternalStore) can repaint "Terhubung: <nama>"
// without any useEffect/setState dance.
export const PRINTER_CHANGED_EVENT = "pos:printer-changed";

type StoredRef = {
  deviceId: string;
  serviceUuid: string;
  characteristicUuid: string;
  name: string;
};

let writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "bluetooth" in navigator &&
    !!navigator.bluetooth?.requestDevice
  );
}

function readStoredRef(): StoredRef | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredRef) : null;
  } catch {
    return null;
  }
}

function writeStoredRef(ref: StoredRef): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ref));
    window.dispatchEvent(new Event(PRINTER_CHANGED_EVENT));
  } catch {
    // localStorage full/blocked — session pairing still works this run.
  }
}

export function getConnectedPrinterName(): string | null {
  return readStoredRef()?.name ?? null;
}

async function findWriteCharacteristic(
  server: BluetoothRemoteGATTServer,
): Promise<{ serviceUuid: string; characteristic: BluetoothRemoteGATTCharacteristic } | null> {
  for (const serviceUuid of KNOWN_SERVICE_UUIDS) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const characteristics = await service.getCharacteristics();
      for (const characteristic of characteristics) {
        if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
          return { serviceUuid, characteristic };
        }
      }
    } catch {
      // Not this service UUID — try the next known one.
    }
  }

  try {
    const services = await server.getPrimaryServices();
    for (const service of services) {
      try {
        const characteristics = await service.getCharacteristics();
        for (const characteristic of characteristics) {
          if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
            return { serviceUuid: service.uuid, characteristic };
          }
        }
      } catch {
        // Unreadable service — skip and keep scanning.
      }
    }
  } catch {
    // Nothing discoverable; caller reports the failure honestly.
  }
  return null;
}

export async function connectPrinter(): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  if (!isWebBluetoothSupported()) {
    return {
      ok: false,
      error: "Web Bluetooth tidak didukung di browser ini. Gunakan Chrome di Android (bukan iPhone/Safari), atau pilih mode cetak RawBT.",
    };
  }

  if (!navigator.bluetooth) {
    return { ok: false, error: "Web Bluetooth tidak tersedia." };
  }

  try {
    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: KNOWN_SERVICE_UUIDS,
    });

    const server = await device.gatt.connect();
    const found = await findWriteCharacteristic(server);
    if (!found) {
      server.disconnect();
      return {
        ok: false,
        error: "Printer terhubung, tapi tidak ditemukan karakteristik BLE yang bisa ditulis. Coba printer lain di daftar, atau pakai mode RawBT.",
      };
    }

    writeCharacteristic = found.characteristic;
    writeStoredRef({
      deviceId: device.id,
      serviceUuid: found.serviceUuid,
      characteristicUuid: writeCharacteristic.uuid,
      name: device.name ?? "Printer Bluetooth",
    });
    return { ok: true, name: device.name ?? device.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Koneksi Bluetooth dibatalkan atau gagal.",
    };
  }
}

async function ensureConnected(): Promise<void> {
  if (writeCharacteristic) return;
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth tidak didukung di browser ini.");
  }
  if (!navigator.bluetooth?.getDevices) {
    throw new Error("Peramban ini belum membuka izin Bluetooth untuk ulang-konek. Hubungkan printer lewat Pengaturan dulu.");
  }

  const ref = readStoredRef();
  if (!ref) {
    throw new Error("Belum ada printer dihubungkan — buka Pengaturan lalu tekan \"Hubungkan Bluetooth\".");
  }

  const devices = await navigator.bluetooth.getDevices();
  const device = devices.find((candidate) => candidate.id === ref.deviceId) ?? null;
  if (!device) {
    throw new Error("Printer tidak ditemukan. Hidupkan & dekatkan tablet, lalu hubungkan ulang lewat Pengaturan.");
  }

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(ref.serviceUuid);
  writeCharacteristic = await service.getCharacteristic(ref.characteristicUuid);
}

function fail(error: unknown): PrintResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : "Cetak Bluetooth gagal tanpa keterangan.",
  };
}

// A GATT write value can never exceed 512 bytes — Chrome enforces that
// client-side ("Value can't exceed 512 bytes"), and most thermal BLE
// firmware buffers one MTU-worth per frame on the 8051 bridge anyway. So the
// ESC/POS payload (a 50-line receipt is often 1,000+ bytes) is split into
// ≤512-byte frames with a short beat between them for the bridge's UART
// buffer to flush before the next frame lands. Without the pause, cheap
// printer firmware drops bytes and prints garbage.
const MAX_WRITE_CHUNK = 512;
// Real MTU (~509 on modern Android/Chrome after negotiation) puts us well
// under the cap with a round 500; making it smaller than 512 adds nothing
// except more frames, so keep it at the hard Chrome limit.
const CHUNK_GAP_MS = 30;

async function writeChunked(bytes: Uint8Array): Promise<void> {
  for (let offset = 0; offset < bytes.length; offset += MAX_WRITE_CHUNK) {
    const chunk = bytes.subarray(offset, offset + MAX_WRITE_CHUNK);
    if (writeCharacteristic?.properties.write) {
      await writeCharacteristic.writeValue(chunk);
    } else {
      // write-without-response path — also chunked to the same bound so a
      // packet can never overflow the negotiated MTU buffer either.
      await writeCharacteristic?.writeValueWithoutResponse(chunk);
    }
    if (offset + MAX_WRITE_CHUNK < bytes.length) {
      await new Promise((resolve) => setTimeout(resolve, CHUNK_GAP_MS));
    }
  }
}

async function writeBytes(bytes: Uint8Array): Promise<PrintResult> {
  try {
    await ensureConnected();
    if (!writeCharacteristic) throw new Error("Belum ada printer terhubung.");
    await writeChunked(bytes);
    return { ok: true };
  } catch (error) {
    writeCharacteristic = null;
    return fail(error);
  }
}

export const webBluetoothPrinter: Printer = {
  async printReceipt(data: ReceiptData): Promise<PrintResult> {
    return writeBytes(buildReceiptBytes(await withLogo(data)));
  },
  async printPackingList(data: PackingListData): Promise<PrintResult> {
    return writeBytes(buildPackingListBytes(await withLogo(data)));
  },
};