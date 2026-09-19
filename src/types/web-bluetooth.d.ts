// Minimal subset of the Web Bluetooth API (Chrome/Edge only, secure
// context). TypeScript's lib.dom deliberately omits this Chrome-only API, so
// the printer driver declares just the shapes it actually uses instead of
// pulling in a full third-party @types package. Everything is inside
// `declare global` so the names are visible everywhere (module-level
// interfaces would stay local to this file).

declare global {
  interface BluetoothRemoteGATTCharacteristic {
    readonly uuid: string;
    readonly properties: {
      write: boolean;
      writeWithoutResponse: boolean;
    };
    writeValue(value: Uint8Array): Promise<void>;
    writeValueWithoutResponse(value: Uint8Array): Promise<void>;
  }

  interface BluetoothRemoteGATTService {
    readonly uuid: string;
    getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristic>;
    getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
  }

  interface BluetoothRemoteGATTServer {
    connect(): Promise<BluetoothRemoteGATTServer>;
    disconnect(): void;
    getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTService>;
    getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>;
  }

  interface BluetoothDevice {
    readonly id: string;
    readonly name?: string;
    readonly gatt: BluetoothRemoteGATTServer;
  }

  interface BluetoothNavigator {
    requestDevice(options: { acceptAllDevices: boolean; optionalServices: string[] }): Promise<BluetoothDevice>;
    getDevices(): Promise<BluetoothDevice[]>;
  }

  interface Navigator {
    bluetooth?: BluetoothNavigator;
  }
}

export {};