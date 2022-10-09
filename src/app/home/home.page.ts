import { Component, NgZone } from '@angular/core';
import { BleClient, BleDevice, numberToUUID, ScanResult, dataViewToText, textToDataView } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { ConnectedDevices } from './home.interfaces';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {
  connectedDevices: ConnectedDevices[] = [];
  connectDeviceLoading;
  disconnectDeviceLoading;

  // dataTemp = '0 F'; //°C
  // dataUnit = 'F';

  THERMOMETER_SERVICE_UUID = "00000001-710e-4a5b-8d75-3e5b444bc3cf";
  HEART_RATE_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
  // TEMP_CHARACTERISTIC_UUID = "00000002-710e-4a5b-8d75-3e5b444bc3cf";
  // UNIT_CHARACTERISTIC_UUID = "00000003-710e-4a5b-8d75-3e5b444bc3cf";

  constructor(
    private toast: ToastController,
    private ngZone: NgZone,
    private loading: LoadingController,
    private alert: AlertController
  ) { }

  async scanDevices(modal) {

    try {
      if (!await BleClient.isEnabled()) throw 'Please enable your bluetooth.';

      await BleClient.initialize({ androidNeverForLocation: true });

      let deviceConnected;
      deviceConnected = await BleClient.requestDevice({
        services: [],
        namePrefix: 'rn',
        optionalServices: [this.THERMOMETER_SERVICE_UUID],
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
      console.log(deviceConnectedServices)
      this.connectedDevices.push({
        ...deviceConnected,
        services: deviceConnectedServices
      })
      console.log(this.connectedDevices)

      if (this.connectDeviceLoading) await this.connectDeviceLoading.dismiss();
    } catch (error) {
      console.error(error);

      if (this.connectDeviceLoading) await this.connectDeviceLoading.dismiss();

      let toast = await this.toast.create({
        message: error?.toString() || 'Terjadi Kesalahan. Periksa Bluetooth Anda.',
        mode: 'ios',
        duration: 3000,
        color: 'danger'
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

  // async startTempNotification() {
  //   await BleClient.startNotifications(
  //     this.deviceConnected.deviceId,
  //     this.THERMOMETER_SERVICE_UUID,
  //     this.TEMP_CHARACTERISTIC_UUID,
  //     (value) => {
  //       console.log('current heart rate', dataViewToText(value));
  //       this.ngZone.run(() => {
  //         this.dataTemp = dataViewToText(value);
  //         this.dataUnit = this.dataTemp.replace(/[^a-zA-Z]+/g, '');
  //       });
  //     }
  //   )
  // }

  // async stopTempNotification() {
  //   try {
  //     await BleClient.stopNotifications(
  //       this.deviceConnected.deviceId,
  //       this.THERMOMETER_SERVICE_UUID,
  //       this.TEMP_CHARACTERISTIC_UUID
  //     )
  //   } catch (error) {
  //     console.log(error)
  //   }
  // }


  // async requestUpdateTempData() {
  //   if (!this.deviceConnected?.deviceId) {
  //     let toastNoDevice = await this.toast.create({
  //       message: 'Unable to Update Data, No Device Connected',
  //       mode: 'ios',
  //       color: 'danger',
  //       duration: 3000,
  //       buttons: [{ icon: 'close' }]
  //     })
  //     toastNoDevice.present();
  //     return;
  //   }
  //   const result = await BleClient.read(this.deviceConnected.deviceId, this.THERMOMETER_SERVICE_UUID, this.TEMP_CHARACTERISTIC_UUID);
  //   console.log('temp: ', dataViewToText(result));
  //   this.dataTemp = dataViewToText(result)
  //   this.dataUnit = this.dataTemp.replace(/[^a-zA-Z]+/g, '');
  // }

  // async requestChangeUnitData() {
  //   await BleClient.write(
  //     this.deviceConnected.deviceId,
  //     this.THERMOMETER_SERVICE_UUID,
  //     this.UNIT_CHARACTERISTIC_UUID,
  //     textToDataView(this.dataUnit === 'F' ? 'C' : 'F')
  //   )
  //   this.requestUpdateTempData();
  // }
}
