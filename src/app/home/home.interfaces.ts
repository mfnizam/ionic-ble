import { BleDevice, BleService, BleServices } from "@capacitor-community/bluetooth-le";

export interface ConnectedDevices extends BleDevice {
    services: BleService[];
}