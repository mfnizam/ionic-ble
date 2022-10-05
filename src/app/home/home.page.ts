import { Component, NgZone } from '@angular/core';
import { BleClient, BleDevice, numberToUUID, ScanResult, dataViewToText, textToDataView } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage {

  bluetoothScanResults: ScanResult[] = [/* {
    device: {
      name: 'Xiomi Bluetooth Plus',
      deviceId: 'A4:AD:FF:4D:3D'
    }
  } */];
  bluetoothIsScanning = false;
  deviceConnected: BleDevice;
  connectDeviceLoading;
  disconnectDeviceLoading;

  dataTemp = '0 F'; //°C
  dataUnit = 'F';

  GENERIC_SERVICE = numberToUUID(0x180A);
  THERMOMETER_SERVICE_UUID = "00000001-710e-4a5b-8d75-3e5b444bc3cf";
  TEMP_CHARACTERISTIC_UUID = "00000002-710e-4a5b-8d75-3e5b444bc3cf";
  UNIT_CHARACTERISTIC_UUID = "00000003-710e-4a5b-8d75-3e5b444bc3cf";

  constructor(
    private toast: ToastController,
    private ngZone: NgZone,
    private loading: LoadingController,
    private alert: AlertController
  ) { }

  async scanDevices(modal) {
    // if (['ios', 'android'].includes(Capacitor.getPlatform())) modal.present();

    console.log('bluetooth device status: ', BleClient.isEnabled())

    try {
      await BleClient.initialize({ androidNeverForLocation: true });
      this.bluetoothScanResults = [];
      this.bluetoothIsScanning = true;

      let deviceConnected;

      // if (['ios', 'android'].includes(Capacitor.getPlatform())) {
      //   await BleClient.requestLEScan({ services: [] }, result => { 
      //     this.ngZone.run(() => { this.bluetoothScanResults.push(result); }); 
      //   });

      //   setTimeout(async () => {
      //     await BleClient.stopLEScan();
      //     console.log('stopped scanning');
      //     this.bluetoothIsScanning = false;
      //   }, 30000);
      // } else {
      deviceConnected = await BleClient.requestDevice({
        services: [],
        namePrefix: 'Thermometer',
        optionalServices: [this.THERMOMETER_SERVICE_UUID],
      });
      console.log(deviceConnected)
      // }

      this.connectDeviceLoading = await this.loading.create({
        message: 'Connecting to ' + deviceConnected.name + '...',
        mode: 'ios'
      })

      await this.connectDeviceLoading.present()

      // connect to device
      await BleClient.connect(deviceConnected.deviceId, this.onDeviceDisconnected.bind(this));
      this.deviceConnected = deviceConnected;
      console.log('connected to device', this.deviceConnected);

      if (this.connectDeviceLoading) await this.connectDeviceLoading.dismiss();

      await this.startTempNotification();

    } catch (error) {
      console.error(error);
      this.bluetoothIsScanning = false;
      if (this.connectDeviceLoading) await this.connectDeviceLoading.dismiss();
      let toast = await this.toast.create({
        message: error.toString().split(':')[1] || 'Gagal Scan Device. Periksa Bluetooth Anda.',
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
    let toastDeviceDisconnected = await this.toast.create({
      message: 'Device ' + this.deviceConnected.name + ' disconnected',
      mode: 'ios',
      duration: 3000,
      buttons: [{ icon: 'close' }]
    })
    toastDeviceDisconnected.present();
    this.deviceConnected = null;
  }

  onModalScanDevicesDidDismiss(e) {}

  async startTempNotification() {
    await BleClient.startNotifications(
      this.deviceConnected.deviceId,
      this.THERMOMETER_SERVICE_UUID,
      this.TEMP_CHARACTERISTIC_UUID,
      (value) => {
        console.log('current heart rate', dataViewToText(value));
        this.ngZone.run(() => {
          this.dataTemp = dataViewToText(value);
          this.dataUnit = this.dataTemp.replace(/[^a-zA-Z]+/g, '');
        });
      }
    )
  }

  async stopTempNotification() {
    await BleClient.stopNotifications(
      this.deviceConnected.deviceId,
      this.THERMOMETER_SERVICE_UUID,
      this.TEMP_CHARACTERISTIC_UUID
    )
  }

  async disconnectDevice() {
    if (!this.deviceConnected.deviceId) {
      let toastNoDevice = await this.toast.create({
        message: 'Unable to Disconnect, No Device Connected',
        mode: 'ios',
        color: 'danger',
        duration: 3000,
        buttons: [{ icon: 'close' }]
      })
      toastNoDevice.present();
      return
    }
    let promtDisconnectDevice = await this.alert.create({
      header: 'Disconect Device',
      message: 'Are you sure you want to disconnect ' + this.deviceConnected.name + '?',
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
    this.disconnectDeviceLoading.present();
    await this.stopTempNotification()
    await BleClient.disconnect(this.deviceConnected.deviceId);
  }

  async requestUpdateTempData() {
    if (!this.deviceConnected?.deviceId) {
      let toastNoDevice = await this.toast.create({
        message: 'Unable to Update Data, No Device Connected',
        mode: 'ios',
        color: 'danger',
        duration: 3000,
        buttons: [{ icon: 'close' }]
      })
      toastNoDevice.present();
      return;
    }
    const result = await BleClient.read(this.deviceConnected.deviceId, this.THERMOMETER_SERVICE_UUID, this.TEMP_CHARACTERISTIC_UUID);
    console.log('temp: ', dataViewToText(result));
    this.dataTemp = dataViewToText(result)
    this.dataUnit = this.dataTemp.replace(/[^a-zA-Z]+/g, '');
  }

  async requestChangeUnitData() {
    await BleClient.write(
      this.deviceConnected.deviceId,
      this.THERMOMETER_SERVICE_UUID,
      this.UNIT_CHARACTERISTIC_UUID,
      textToDataView(this.dataUnit === 'F' ? 'C' : 'F')
    )
    this.requestUpdateTempData();
  }
}
