import { BleCharacteristic, BleDescriptor, BleDevice, BleService, BleServices } from "@capacitor-community/bluetooth-le";

export interface ConnectedDevices extends BleDevice {
    services: Service[];
}

export interface Service extends BleService {
    name?: string,
    characteristics: Characteristic[]
}

export interface Characteristic extends BleCharacteristic {
    isnotify?: boolean;
    value?: any;
    description: any;
}