import BaseController from "./BaseController";
import TransactionController from "sap/ui/generic/app/transaction/TransactionController";
import UIComponent from "sap/ui/core/UIComponent";
import includeScript from "sap/ui/dom/includeScript";
import Paypal from "../paypal/paypal";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import Event from "sap/ui/base/Event";
import Table from "sap/m/Table";
import Filter from "sap/ui/model/Filter";
import ColumnListItem from "sap/m/ColumnListItem";
import Text from "sap/m/Text";
import ObjectNumber from "sap/m/ObjectNumber";
import Context from "sap/ui/model/odata/v2/Context";
import MessageBox from "sap/m/MessageBox";
import {
  SubmitChangesParameters,
  DraftResponse,
  FunctionImportResponse,
  Donation,
  PayPalAction,
  PayPalPurchaseOrder,
  DraftAdministrativeData
} from "zpaypal_donation/common/types";
import ListItem from "sap/ui/core/ListItem";
import Button from "sap/m/Button";
import ListItemBase from "sap/m/ListItemBase";
import ObjectMarker from "sap/m/ObjectMarker";
import { ObjectMarkerType } from "sap/m/library";
import Draft from "zpaypal_donation/common/Draft";

/**
 * @namespace zpaypal_donation
 */
export default class Main extends BaseController {
  private _transactionController: TransactionController;

  public onInit(): void {
    const model = this.getModel() as ODataModel;
    const component = this.getOwnerComponent() as UIComponent;
    component?.getRouter().getRoute("Main")?.attachPatternMatched(this._onMainPatternMatched, this);
    // @ts-ignore
    this._transactionController = new TransactionController(model);
    model.attachPropertyChange(this._onModelPropertyChange, this);
  }

  public onAfterRendering(): void {
    this._initAndRenderPayPal();
    this._bindMyDraftsTable();
    this._bindAllDonationsTable();
  }

  private _onModelPropertyChange(): void {
    this._transactionController.triggerSubmitChanges({} as SubmitChangesParameters);
  }

  private _onMainPatternMatched(): void {
    this.getModel()
      .metadataLoaded()
      .then((): void => this._createNewDraftDonation());
  }

  private _initAndRenderPayPal(): void {
    this._initPayPal().then((): void => {
      // @ts-ignore -> paypal is a global from the PayPal script
      paypal
        .Buttons({
          onClick: this._onPaypalButtonClick.bind(this),
          createOrder: this._createPayPalOrder.bind(this),
          onApprove: this._onPayPalOrderApporve.bind(this)
        })
        .render(`#${this.createId("paypalButtonContainer")}`);
    });
  }

  private _initPayPal(): Promise<object> {
    return includeScript({
      url: `https://www.paypal.com/sdk/js?client-id=${Paypal.CLIENT_ID}&components=buttons&currency=EUR`
    }) as Promise<object>;
  }

  public onMyDraftItemPress(event: Event): void {
    const listItem = event.getParameter("listItem" as never) as ListItem;
    const bindingContext = listItem.getBindingContext() as Context;
    this._bindDonationSmartForm(bindingContext.getPath());
  }

  public onAllDonationsItemPress(event: Event): void {
    const listItem = event.getParameter("listItem" as never) as ListItem;
    const bindingContext = listItem.getBindingContext() as Context;
    this._bindDonationSmartForm(bindingContext.getPath());
  }

  public onMyDraftDeletePress(event: Event): void {
    const listItem = event.getParameter("listItem" as never) as ListItem;
    const bindingContext = listItem.getBindingContext() as Context;
    this._handleDeleteDraft(bindingContext);
  }

  public onDeleteDonationPress(): void {
    const table = this.getView()?.byId("allDonationsTable") as Table;
    const bindingContext = table.getSelectedContexts().at(0) as Context;
    this._handleDeleteDraft(bindingContext);
  }

  public onDeleteAllDraftsPress(): void {
    const table = this.getView()?.byId("myDraftsTable") as Table;
    const listItems = table.getItems() as ListItemBase[];
    const deleteRequests: Array<Promise<object>> = listItems.map(
      (listItem: ListItemBase): Promise<object> => {
        const bindingContext = listItem.getBindingContext() as Context;
        return this._transactionController.deleteEntity(bindingContext, /* parameters  => */ {});
      }
    );
    Promise.all(deleteRequests).then((): void => this._handleAfterDraftDelete());
  }

  _handleDeleteDraft(draftContext: Context): void {
    this._transactionController
      .deleteEntity(draftContext, /* parameters => */ {})
      .then((): void => this._handleAfterDraftDelete());
  }

  private _handleAfterDraftDelete(): void {
    this.getView()?.byId("donationSmartForm")?.unbindObject();
    this.getModel().refresh(true);
    const deleteButton = this.getView()?.byId("allDonationsTableDeleteButton") as Button;
    deleteButton?.setEnabled(false);
  }

  private _bindDonationSmartForm(bindingPath: string): void {
    this.getView()?.byId("donationSmartForm")?.bindElement(bindingPath);
  }

  public onCreateDonationDraftPress(): void {
    this._createNewDraftDonation();
  }

  public onAllDonationsSelectionChange(event: Event): void {
    const selectedItem: ListItem = event.getParameter("listItem" as never);
    if (selectedItem) {
      const context = selectedItem.getBindingContext() as Context;
      const isDeleteable: boolean = context.getProperty("Delete_mc");
      const deleteButton = this.getView()?.byId("allDonationsTableDeleteButton") as Button;
      deleteButton?.setEnabled(isDeleteable);
    }
  }

  private _createNewDraftDonation(): void {
    this._transactionController
      .getDraftController()
      .createNewDraftEntity("Donation", "/Donation")
      .then((response: DraftResponse): void =>
        this._bindDonationSmartForm(response.context.getPath())
      );
  }

  private _bindMyDraftsTable(): void {
    const table = this.getView()?.byId("myDraftsTable") as Table;
    table.bindItems({
      path: "/Donation",
      templateShareable: false,
      parameters: {
        expand: "DraftAdministrativeData,SiblingEntity"
      },
      filters: [
        new Filter({
          filters: [
            new Filter("DraftAdministrativeData/DraftIsLastChangedByMe", "EQ", true),
            new Filter("IsActiveEntity", "EQ", false)
          ],
          and: true
        })
      ],
      template: this._getMyDraftsTableTemplate()
    });
  }

  private _bindAllDonationsTable(): void {
    const table = this.getView()?.byId("allDonationsTable") as Table;
    table.bindItems({
      path: "/Donation",
      templateShareable: false,
      parameters: {
        expand: "DraftAdministrativeData,SiblingEntity"
      },
      filters: [
        new Filter({
          filters: [
            new Filter("IsActiveEntity", "EQ", false),
            new Filter("SiblingEntity/IsActiveEntity", "EQ", null)
          ],
          and: false
        })
      ],
      template: this._getAllDonationsTableTemplate()
    });
  }

  private _getAllDonationsTableTemplate(): ColumnListItem {
    return new ColumnListItem({
      type: "Active",
      highlight: "{= ${IsActiveEntity} ? 'None' : 'Information' }",
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
        }),
        new ObjectMarker({
          type: {
            path: "DraftAdministrativeData",
            formatter: this._mapDraftObjectMarkerType
          },
          additionalInfo: {
            path: "DraftAdministrativeData",
            formatter: this._mapDraftObjectMarkerAdditionalInfo
          }
        })
      ]
    });
  }

  private _mapDraftObjectMarkerType(
    draftAdministrativeData: DraftAdministrativeData
  ): ObjectMarkerType | undefined {
    if (Draft.isMyOwn(draftAdministrativeData)) {
      return ObjectMarkerType.Draft;
    }
    if (Draft.isUnsavedByMe(draftAdministrativeData)) {
      return ObjectMarkerType.Unsaved;
    }
    if (Draft.isLockedByOtherUser(draftAdministrativeData)) {
      return ObjectMarkerType.LockedBy;
    }
    if (Draft.isUnsavedByOtherUser(draftAdministrativeData)) {
      return ObjectMarkerType.UnsavedBy;
    }
  }

  private _mapDraftObjectMarkerAdditionalInfo(
    draftAdministrativeData: DraftAdministrativeData
  ): string | undefined {
    if (Draft.isLockedByOtherUser(draftAdministrativeData)) {
      return draftAdministrativeData.InProcessByUserDescription;
    }
    if (Draft.isUnsavedByOtherUser(draftAdministrativeData)) {
      return draftAdministrativeData.InProcessByUserDescription;
    }
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
      this.getModel().callFunction("/SetDonationAsPaid", {
        urlParameters: {
          DonationID: donationContext.getProperty("DonationID"),
          IsActiveEntity: donationContext.getProperty("IsActiveEntity")
        },
        eTag: this.getModel().getETag(donationContext.getPath()) as string,
        method: "POST",
        success: resolve,
        error: reject
      });
    });
  }

  private _getCurrentDonationContext(): Context {
    return this.getView()?.byId("donationSmartForm")?.getBindingContext() as Context;
  }

  private async _onPaypalButtonClick(data: any, actions: PayPalAction): Promise<any> {
    const context: Context = this._getCurrentDonationContext();
    try {
      const response: DraftResponse = await this._transactionController
        .getDraftController()
        .activateDraftEntity(context, /* isLenient => */ false, /* expand => */ "");
      this._bindDonationSmartForm(response.context.getPath());
      return actions.resolve();
    } catch {
      return actions.reject();
    }
  }

  private _createPayPalOrder(data: any, actions: PayPalAction): Promise<object> {
    const purchaseOrder: PayPalPurchaseOrder = {
      purchase_units: [
        {
          amount: {
            currency_code: this._getCurrentDonationContext().getProperty("Currency"),
            value: this._getCurrentDonationContext().getProperty("Value")
          }
        }
      ]
    };
    return actions.order.create(purchaseOrder);
  }

  private _onPayPalOrderApporve(data: object, actions: PayPalAction): Promise<object> {
    return actions.order.capture().then((details: any): void => {
      const context: Context = this._getCurrentDonationContext();
      this._setDonationAsPaid(context).then((): void =>
        MessageBox.success(`Thank you for your donation, ${details.payer.name.given_name}!`)
      );
    }) as Promise<object>;
  }

  public async onDonationSearch(event: Event): Promise<void> {
    const donationId: string = event.getParameter("query" as never);
    const donationRoot = await this._readDonationRoot(donationId);
    const bindingPath: string = this.getModel().createKey("/Donation", {
      DonationID: donationRoot.DonationID,
      IsActiveEntity: donationRoot.IsActiveEntity
    });
    this._bindDonationSmartForm(bindingPath);
  }

  private _readDonationRoot(donationId: string): Promise<Donation> {
    return new Promise((resolve, reject) => {
      this.getModel().read("/Donation", {
        urlParameters: {
          expand: "DraftAdministrativeData,SiblingEntity"
        },
        filters: [
          new Filter("DonationID", "EQ", donationId),
          new Filter({
            filters: [
              new Filter("SiblingEntity/IsActiveEntity", "EQ", null),
              new Filter("IsActiveEntity", "EQ", false)
            ],
            and: false
          })
        ],
        success: (response: FunctionImportResponse) => {
          if ((response?.results?.length as number) === 1) {
            resolve(response.results.at(0) as unknown as Donation);
            return;
          }
          reject();
        },
        error: reject
      });
    });
  }
}
