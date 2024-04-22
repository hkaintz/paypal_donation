import BaseController from "./BaseController";
import TransactionController from "sap/ui/generic/app/transaction/TransactionController";
import UIComponent from "sap/ui/core/UIComponent";
import includeScript from "sap/ui/dom/includeScript";
import Paypal from "../model/paypal";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Event from "sap/ui/base/Event";
import Table from "sap/m/Table";
import Filter from "sap/ui/model/Filter";
import ColumnListItem from "sap/m/ColumnListItem";
import Text from "sap/m/Text";
import ObjectNumber from "sap/m/ObjectNumber";
import Context from "sap/ui/model/odata/v2/Context";
import MessageBox from "sap/m/MessageBox";

interface DraftResponse {
  context: Context;
}
interface FunctionImportResponse {
  results: [];
}

/**
 * @namespace zpaypal_donation
 */
export default class Main extends BaseController {
  private _transactionController: TransactionController;

  public onInit(): void {
    const router = this.getOwnerComponent() as UIComponent;
    router?.getRouter().getRoute("Main")?.attachPatternMatched(this._onMainPatternMatched, this);

    const model = this.getModel() as ODataModel;
    // @ts-ignore
    this._transactionController = new TransactionController(model);
    model.attachPropertyChange(this._onModelPropertyChange, this);
  }

  public onAfterRendering(): void {
    this._initAndRenderPayPal();
    this._bindMyDraftsTable();
  }

  private _onMainPatternMatched(): void {
    this.getModel()
      ?.metadataLoaded()
      .then((): void => this._createNewDraftDonation());
  }

  private _initAndRenderPayPal(): void {
    this._initPayPal()?.then((): void => {
      // @ts-ignore
      paypal
        .Buttons({
          onClick: this._onPaypalButtonClick.bind(this),
          createOrder: this._createPayPalOrder.bind(this),
          onApprove: this._onPayPalOrderApporve.bind(this)
        })
        .render(`#${this.createId("paypal-button-container")}`);
    });
  }

  private _initPayPal(): Promise<unknown> {
    return includeScript({
      url: `https://www.paypal.com/sdk/js?client-id=${Paypal.CLIENT_ID}&components=buttons&currency=EUR`
    }) as Promise<unknown>;
  }

  private _onModelPropertyChange(): void {
    // @ts-ignore
    this._transactionController.triggerSubmitChanges();
  }

  public onMyDraftItemPress(event: Event): void {
    // @ts-ignore
    const bindingContext = event.getParameter("listItem")?.getBindingContext();
    this._bindDonationSmartForm(bindingContext);
  }

  public onMyDraftDeletePress(event: Event): void {
    // @ts-ignore
    const bindingContext = event.getParameter("listItem")?.getBindingContext();
    this._transactionController
      .deleteEntity(bindingContext, /* Parameters that control the behavior of the request => */ {})
      .then((): void => this._handleAfterDraftDelete());
  }

  private _handleAfterDraftDelete(): void {
    setTimeout((): void => {
      this.getModel()?.refresh(true);
      this.getView()?.byId("smartForm")?.unbindObject();
    }, 100); // TODO: Find better solution
  }

  private _bindDonationSmartForm(context: Context): void {
    const path = context.getPath() as string;
    this.getView()?.byId("smartForm")?.bindElement(path);
  }

  public onCreateDonationDraftPress(): void {
    this._createNewDraftDonation();
  }

  private _createNewDraftDonation(): void {
    this._transactionController
      .getDraftController()
      .createNewDraftEntity("Donation", "/Donation")
      .then((response: DraftResponse): void => this._bindDonationSmartForm(response.context));
  }

  private _bindMyDraftsTable(): void {
    const table = this.getView()?.byId("myDraftsTable") as Table;
    table?.bindItems({
      path: "/Donation",
      templateShareable: false,
      parameters: {
        expand: "DraftAdministrativeData,SiblingEntity"
      },
      filters: [
        new Filter("DraftAdministrativeData/DraftIsCreatedByMe", "EQ", true),
        new Filter({
          filters: [
            new Filter("IsActiveEntity", "EQ", false),
            new Filter("SiblingEntity/IsActiveEntity", "EQ", null)
          ],
          and: false
        })
      ],
      template: this._getMyDraftsTableTemplate()
    });
  }

  private _getMyDraftsTableTemplate(): ColumnListItem {
    return new ColumnListItem({
      type: "Active",
      cells: [
        new Text({
          text: "{FirstName} {LastName}"
        }),
        new ObjectNumber({
          number: {
            parts: [{ path: "Value" }, { path: "Currency" }],
            type: "sap.ui.model.type.Currency",
            formatOptions: { showMeasure: false }
          },
          unit: "{Currency}"
        })
      ]
    });
  }

  private _setDonationAsPaid(donationContext: Context): Promise<FunctionImportResponse> {
    return new Promise((resolve, reject) => {
      this.getModel()?.callFunction("/_setDonationAsPaid", {
        urlParameters: {
          DonationID: donationContext.getProperty("DonationID"),
          IsActiveEntity: donationContext.getProperty("IsActiveEntity")
        },
        eTag: this.getModel()?.getETag(donationContext.getPath()) as string,
        method: "POST",
        success: resolve,
        error: reject
      });
    });
  }

  private _getCurrentDonationContext(): Context {
    return this.getView()?.byId("smartForm")?.getBindingContext() as Context;
  }

  private async _onPaypalButtonClick(data: any, actions: any): Promise<any> {
    const context: Context = this._getCurrentDonationContext();
    try {
      const response: DraftResponse = await this._transactionController
        .getDraftController()
        // @ts-ignore
        .activateDraftEntity(context);
      this._bindDonationSmartForm(response.context);
      return actions.resolve();
    } catch {
      return actions.reject();
    }
  }

  private _createPayPalOrder(data: any, actions: any): Function {
    return actions.order.create({
      purchase_units: [
        {
          amount: {
            currency_code: this._getCurrentDonationContext().getProperty("Currency"),
            value: this._getCurrentDonationContext().getProperty("Value")
          }
        }
      ]
    });
  }

  private _onPayPalOrderApporve(data: any, actions: any): Promise<any> {
    return actions.order.capture().then((details: any): void => {
      const context: Context = this._getCurrentDonationContext();
      this._setDonationAsPaid(context).then((): void =>
        MessageBox.success(`Thank you for your donation, ${details.payer.name.given_name}!`)
      );
    });
  }
}
