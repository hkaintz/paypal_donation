import Controller from "sap/ui/core/mvc/Controller";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
/**
 * @namespace zpaypal_donation
 */
export default class BaseController extends Controller {
  public getModel(): ODataModel {
    return this.getOwnerComponent()?.getModel() as ODataModel;
  }
}
