import { Component, NgZone } from '@angular/core';
import { BleClient, BleDevice, numberToUUID, ScanResult, dataViewToText, textToDataView, BleCharacteristic } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { Characteristic, ConnectedDevices } from './home.interfaces';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  connectedDevices: ConnectedDevices[] = [];
  connectDeviceLoading;
  disconnectDeviceLoading;

  THERMOMETER_SERVICE_UUID = [
    "00000001-710e-4a5b-8d75-3e5b444bc3cf",
    "00000011-710e-4a5b-8d75-3e5b444bc3cf",
    "00000021-710e-4a5b-8d75-3e5b444bc3cf",
    "00000031-710e-4a5b-8d75-3e5b444bc3cf",
    "00000041-710e-4a5b-8d75-3e5b444bc3cf",
    "00000051-710e-4a5b-8d75-3e5b444bc3cf",
    "00000061-710e-4a5b-8d75-3e5b444bc3cf",
    "00000071-710e-4a5b-8d75-3e5b444bc3cf",
    "00000081-710e-4a5b-8d75-3e5b444bc3cf",
    "00000091-710e-4a5b-8d75-3e5b444bc3cf",
    "00000101-710e-4a5b-8d75-3e5b444bc3cf",
    "00000111-710e-4a5b-8d75-3e5b444bc3cf",
    "00000121-710e-4a5b-8d75-3e5b444bc3cf",
    "00000131-710e-4a5b-8d75-3e5b444bc3cf",
    "00000141-710e-4a5b-8d75-3e5b444bc3cf",
    "00000151-710e-4a5b-8d75-3e5b444bc3cf",
    "00000161-710e-4a5b-8d75-3e5b444bc3cf",
    "00000171-710e-4a5b-8d75-3e5b444bc3cf",
    "00000181-710e-4a5b-8d75-3e5b444bc3cf",
    "00000191-710e-4a5b-8d75-3e5b444bc3cf",
  ]
 
  constructor(
    private toast: ToastController,
    private ngZone: NgZone,
    private loading: LoadingController,
    private alert: AlertController
  ) { }

  async scanDevices() {
    try {
      if (!await BleClient.isEnabled()) throw 'Please enable your bluetooth.';

      await BleClient.initialize({ androidNeverForLocation: true });

      let deviceConnected;
      deviceConnected = await BleClient.requestDevice({
        services: [],
        namePrefix: 'Stampede',
        optionalServices: this.THERMOMETER_SERVICE_UUID
      });

      if (this.connectedDevices.findIndex(v => v.deviceId === deviceConnected.deviceId) != -1)
        throw 'Device already connected. Please remove/disconnect device first.';

      this.connectDeviceLoading = await this.loading.create({
        message: 'Connecting to ' + deviceConnected.name + '...',
        mode: 'ios'
      })
      await this.connectDeviceLoading.present()

      // connect to device
      await BleClient.connect(deviceConnected.deviceId, this.onDeviceDisconnected.bind(this));
      let deviceConnectedServices = await BleClient.getServices(deviceConnected.deviceId).catch(err => console.log(err));

      this.connectedDevices.push({
        ...deviceConnected,
        services: deviceConnectedServices
      })
      console.log(this.connectedDevices, deviceConnectedServices)

      if (this.connectDeviceLoading) await this.connectDeviceLoading.dismiss();

      await this.getCharacteristicDescription(this.connectedDevices[this.connectedDevices.length - 1]);

    } catch (error) {
      console.error(error);

      if (this.connectDeviceLoading) await this.connectDeviceLoading.dismiss();

      let toast = await this.toast.create({
        message: error?.toString() || 'Terjadi Kesalahan. Periksa Bluetooth Anda.',
        mode: 'ios',
        duration: 3000,
        color: 'danger',
        buttons: [{ icon: 'close' }]
      })
      toast.present();
    }

  }

  async onDeviceDisconnected(deviceId) {
    console.log('disconnect device: ' + deviceId)
    if (this.disconnectDeviceLoading) this.disconnectDeviceLoading.dismiss()

    let indexDisconnectedDevice = this.connectedDevices.findIndex(v => v.deviceId == deviceId);
    if (indexDisconnectedDevice == -1) return;

    let toastDeviceDisconnected = await this.toast.create({
      message: 'Device ' + this.connectedDevices[indexDisconnectedDevice]?.name + ' disconnected',
      mode: 'ios',
      duration: 3000,
      buttons: [{ icon: 'close' }]
    })
    toastDeviceDisconnected.present();
    console.log('Device ' + this.connectedDevices[indexDisconnectedDevice]?.name + ' disconnected')
    this.connectedDevices.splice(indexDisconnectedDevice, 1)
  }

  async disconnectDevice(deviceId, name) {
    try {
      if (!deviceId) throw 'Unable to disconnect device'
      let promtDisconnectDevice = await this.alert.create({
        header: 'Disconect Device',
        message: 'Are you sure you want to disconnect ' + name + '?',
        mode: 'ios',
        buttons: [{
          text: 'Cancel',
          role: 'cancel'
        }, {
          text: 'Disconnect',
          role: 'disconnect'
        }]
      })

      promtDisconnectDevice.present();
      let { role } = await promtDisconnectDevice.onDidDismiss();
      if (role !== 'disconnect') return;

      this.disconnectDeviceLoading = await this.loading.create({
        message: 'Attempting to disconnect device...',
        mode: 'ios',
      })

      // TODO: add disconnect all service on the device

      this.disconnectDeviceLoading.present();
      await BleClient.disconnect(deviceId);
    } catch (error) {
      console.error(error);
      let toast = await this.toast.create({
        message: error.toString() || 'Unable to disconnect the device',
        mode: 'ios',
        duration: 3000,
        color: 'danger'
      })
      toast.present();
    }
  }

  async readCharacteristic(deviceId: string, serviceUUID: string, characteristic: Characteristic) {
    try {
      let result = await BleClient.read(deviceId, serviceUUID, characteristic.uuid);
      characteristic.value = dataViewToText(result);
    } catch (error) {
      console.error(error);
      let toast = await this.toast.create({
        message: error?.toString() || 'Terjadi Kesalahan. Coba beberapa saat lagi.',
        mode: 'ios',
        duration: 3000,
        color: 'danger',
        buttons: [{ icon: 'close' }]
      })
      toast.present();
    }
  }

  async notifyCharacteristic(deviceId: string, serviceUUID: string, characteristic: Characteristic) {
    try {
      if (characteristic.isnotify) {
        await BleClient.stopNotifications(
          deviceId,
          serviceUUID,
          characteristic.uuid
        )
        characteristic.isnotify = false;
        characteristic.value = null;
        return;
      }
      await BleClient.startNotifications(
        deviceId,
        serviceUUID,
        characteristic.uuid,
        (value) => {
          characteristic.isnotify = true;
          console.log('current value', dataViewToText(value));
          this.ngZone.run(() => {
            characteristic.value = dataViewToText(value);
          });
        }
      )
    } catch (error) {
      console.error(error);
      let toast = await this.toast.create({
        message: error?.toString() || 'Terjadi Kesalahan. Coba beberapa saat lagi.',
        mode: 'ios',
        duration: 3000,
        color: 'danger',
        buttons: [{ icon: 'close' }]
      })
      toast.present();
    }
  }

  async writeCharacteristic(deviceId: string, serviceUUID: string, characteristic: Characteristic) {
    const alert = await this.alert.create({
      header: 'Write Value to Device',
      mode: 'ios',
      buttons: [{ text: 'cancel', role: 'cancel' }, { text: 'Send', role: 'ok' }],
      inputs: [{
        placeholder: 'Write some value...',
      }]
    });

    await alert.present();
    let { data, role } = await alert.onDidDismiss();
    if (role !== 'ok') return;

    try {
      await BleClient.write(
        deviceId,
        serviceUUID,
        characteristic.uuid,
        textToDataView(data.values[0])
      )
      this.readCharacteristic(deviceId, serviceUUID, characteristic)
    } catch (error) {
      console.error(error);
      let toast = await this.toast.create({
        message: error?.toString() || 'Terjadi Kesalahan. Coba beberapa saat lagi.',
        mode: 'ios',
        duration: 3000,
        color: 'danger',
        buttons: [{ icon: 'close' }]
      })
      toast.present();
    }
  }

  async getCharacteristicDescription(device: ConnectedDevices) {
    try {
      for (let i = 0; i < device.services.length; i++) {
        let service = device.services[i];
        for (let j = 0; j < service.characteristics.length; j++) {
          let characteristic = service.characteristics[j];
          await this.readDescription(device.deviceId, service.uuid, characteristic)
        }
      }
    } catch (error) {
      console.log(error)
      console.log("unable to get characteristic description")
    }
  }

  async readDescription(deviceId: string, serviceUUID: string, characteristic: Characteristic) {
    let description = await BleClient.readDescriptor(deviceId, serviceUUID, characteristic.uuid, "00002901-0000-1000-8000-00805f9b34fb" /* descriptor.uuid */);
    console.log(dataViewToText(description))
    characteristic.description = dataViewToText(description)
  }
}
