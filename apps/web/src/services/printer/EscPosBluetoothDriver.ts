import { t } from "../../locales/id";
import { generateEscPosReceipt } from "./escpos";
import type { PrinterDriver, ReceiptPayload } from "./types";

/**
 * Standard Bluetooth Low Energy / Classic SPP UUIDs used by 58mm/80mm Thermal Printers
 */
const PRINTER_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb", // Common POS printer service
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent / Serial
  "0000ff00-0000-1000-8000-00805f9b34fb", // Custom SPP
  "0000ae30-0000-1000-8000-00805f9b34fb", // MPT/RPP thermal printer
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

/** The slice of the Web Bluetooth API this driver uses (no DOM typings ship for it). */
interface BleCharacteristic {
  properties: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
}

interface BleService {
  getCharacteristics(): Promise<BleCharacteristic[]>;
}

interface BleServer {
  getPrimaryService(uuid: string): Promise<BleService>;
  getPrimaryServices(): Promise<BleService[]>;
}

interface BleDevice {
  gatt?: { connect(): Promise<BleServer>; disconnect(): void };
}

interface BleNavigator {
  bluetooth?: { requestDevice(options: { acceptAllDevices: true; optionalServices: string[] }): Promise<BleDevice> };
}

const CHUNK_SIZE = 100;

function isWritable(characteristic: BleCharacteristic): boolean {
  return Boolean(characteristic.properties.write || characteristic.properties.writeWithoutResponse);
}

async function findWritableCharacteristic(server: BleServer): Promise<BleCharacteristic | null> {
  for (const serviceUuid of PRINTER_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const found = (await service.getCharacteristics()).find(isWritable);
      if (found) return found;
    } catch {
      // This printer does not expose that service: try the next UUID.
    }
  }
  for (const service of await server.getPrimaryServices()) {
    const found = (await service.getCharacteristics()).find(isWritable);
    if (found) return found;
  }
  return null;
}

export class EscPosBluetoothDriver implements PrinterDriver {
  readonly id = "escpos-bluetooth" as const;
  readonly label = "Thermal Bluetooth (ESC/POS)";

  /** Paired printer, kept after the first chooser so the cashier does not pick it for every receipt. */
  private device: BleDevice | null = null;

  private async pairedDevice(bluetooth: NonNullable<BleNavigator["bluetooth"]>): Promise<BleDevice> {
    if (this.device) return this.device;
    const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: PRINTER_SERVICES });
    this.device = device;
    return device;
  }

  async printReceipt(payload: ReceiptPayload): Promise<void> {
    const bluetooth = (navigator as unknown as BleNavigator).bluetooth;
    if (!bluetooth) {
      throw new Error(
        `${t.printing.printer.bluetoothUnavailable} — Browser ini belum mendukung Web Bluetooth API (gunakan Chrome/Edge di desktop atau Android).`,
      );
    }

    let device: BleDevice | null = null;
    try {
      device = await this.pairedDevice(bluetooth);
      if (!device.gatt) {
        throw new Error(t.printing.printer.noGatt);
      }
      const server = await device.gatt.connect();
      const characteristic = await findWritableCharacteristic(server);
      if (!characteristic) {
        throw new Error(t.printing.printer.noWriteCharacteristic);
      }

      const rawData = generateEscPosReceipt(payload, 58);
      // Small chunks avoid BLE buffer overflow on cheap printers.
      for (let i = 0; i < rawData.length; i += CHUNK_SIZE) {
        const chunk = rawData.slice(i, i + CHUNK_SIZE);
        if (characteristic.properties.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    } catch (err: unknown) {
      // A printer that failed to connect or write may be off or re-paired: ask again next time.
      this.device = null;
      if (err instanceof Error) {
        if (err.name === "NotFoundError" || err.message.includes("User cancelled")) {
          throw new Error(t.printing.printer.pairingCancelled);
        }
        throw new Error(`Gagal mencetak struk Bluetooth: ${err.message}`);
      }
      throw new Error(t.printing.printer.unknownPrintError);
    } finally {
      device?.gatt?.disconnect();
    }
  }
}
