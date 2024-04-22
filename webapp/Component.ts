import UIComponent from "sap/ui/core/UIComponent";
import ErrorHandler from "./controller/ErrorHandler";

/**
 * @namespace zpaypal_donation
 */
export default class Component extends UIComponent {
  public static metadata = {
    manifest: "json"
  };

  private _errorHandler: ErrorHandler;

  public init(): void {
    super.init();
    this.getRouter().initialize();
    this._errorHandler = new ErrorHandler();
    this._errorHandler.registerComponent(this);
  }
}
