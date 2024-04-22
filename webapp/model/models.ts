import JSONModel from "sap/ui/model/json/JSONModel";
import Device from "sap/ui/Device";
/**
 * @namespace zpaypal_donation
 */
export default class models {
  public createDeviceModel(): JSONModel {
    const model = new JSONModel(Device);
    model.setDefaultBindingMode("OneWay");
    return model;
  }
}
