import BaseController from "./BaseController";
import TransactionController from "sap/ui/generic/app/transaction/TransactionController";
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
import Icon from "sap/ui/core/Icon";
import SmartForm from "sap/ui/comp/smartform/SmartForm";

/**
 * @namespace zpaypal_donation
 */
export default class Main extends BaseController {
	private _transactionController: TransactionController;

	public onInit(): void {
		const model = this.getModel() as ODataModel;
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
		const bindingContext = this._getAllDonationsTable()?.getSelectedContexts().at(0) as Context;
		this._handleDeleteDraft(bindingContext);
	}

	private _getAllDonationsTable(): Table | undefined {
		return this.getView()?.byId("allDonationsTable") as Table;
	}

	private _getMyDraftsTable(): Table | undefined {
		return this.getView()?.byId("myDraftsTable") as Table;
	}

	public onDeleteAllDraftsPress(): void {
		const listItems = this._getMyDraftsTable()?.getItems() as ListItemBase[];
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
		this._getDonationSmartForm()?.unbindObject();
		this.getModel().refresh(true);
		const deleteButton = this.getView()?.byId("allDonationsTableDeleteButton") as Button;
		deleteButton?.setEnabled(false);
	}

	private _bindDonationSmartForm(bindingPath: string): void {
		this._getDonationSmartForm()?.bindElement(bindingPath);
	}

	private _getDonationSmartForm(): SmartForm | undefined {
		return this.getView()?.byId("donationSmartForm") as SmartForm;
	}

	public onCreateDonationDraftPress(): void {
		this._createNewDraftDonation();
	}

	public onAllDonationsSelectionChange(event: Event): void {
		const selectedItem: ListItem = event.getParameter("listItem" as never);
		if (selectedItem) {
			const context = selectedItem.getBindingContext() as Context;
			this._handleDeleteButtonEnabled(context);
			this._handleEditButtonEnabled(context);
			this._handleSaveButtonEnabled(context);
			this._bindDonationSmartForm(context.getPath());
		}
	}

	private _handleDeleteButtonEnabled(donationContext: Context): void {
		const isDeleteable: boolean = donationContext.getProperty("Delete_mc");
		const deleteButton = this.getView()?.byId("allDonationsTableDeleteButton") as Button;
		deleteButton?.setEnabled(isDeleteable);
	}

	private _handleEditButtonEnabled(donationContext: Context): void {
		// edit button is only enabled for drafts with feature control edit true
		const isEditdable: boolean = donationContext.getProperty("Edit_ac");
		const isActiveEntity: boolean = donationContext.getProperty("IsActiveEntity");
		const editButton = this.getView()?.byId("allDonationsTableEditButton") as Button;
		editButton?.setEnabled(isEditdable && isActiveEntity);
	}

	private _handleSaveButtonEnabled(donationContext: Context): void {
		const isUpdateable: boolean = donationContext.getProperty("Update_mc");
		const saveButton = this.getView()?.byId("allDonationsTableSaveButton") as Button;
		saveButton?.setEnabled(isUpdateable);
	}

	public onEditDonationPress(): void {
		const bindingContext = this._getAllDonationsTable()?.getSelectedContexts().at(0) as Context;
		this._transactionController
			.editEntity(bindingContext)
			.then((response: DraftResponse) => this._bindDonationSmartForm(response.context.getPath()));
	}

	public onSaveDonationPress(): void {
		const bindingContext = this._getAllDonationsTable()?.getSelectedContexts().at(0) as Context;
		this._transactionController
			.getDraftController()
			.activateDraftEntity(bindingContext, /* isLenient => */ false, /* expand => */ "")
			.then((response: DraftResponse): void => this._bindDonationSmartForm(response.context.getPath()));
	}

	private _createNewDraftDonation(): void {
		this._transactionController
			.getDraftController()
			.createNewDraftEntity("Donation", "/Donation")
			.then((response: DraftResponse): void => this._bindDonationSmartForm(response.context.getPath()));
	}

	private _bindMyDraftsTable(): void {
		this._getMyDraftsTable()?.bindItems({
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
		this._getAllDonationsTable()?.bindItems({
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
				new Icon({
					src: "{= ${Paid} ? 'sap-icon://accept' : 'sap-icon://decline' }",
					color: "{= ${Paid} ? 'Positive' : 'Negative' }"
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
			this.getModel().callFunction("/PayDonation", {
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

	private _getCurrentDonationContext(): Context | undefined {
		return this.getView()?.byId("donationSmartForm")?.getBindingContext() as Context;
	}

	private async _onPaypalButtonClick(data: any, actions: PayPalAction): Promise<any> {
		const context = this._getCurrentDonationContext() as Context;
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
						currency_code: this._getCurrentDonationContext()?.getProperty("Currency"),
						value: this._getCurrentDonationContext()?.getProperty("Value")
					}
				}
			]
		};
		return actions.order.create(purchaseOrder);
	}

	private _onPayPalOrderApporve(data: object, actions: PayPalAction): Promise<object> {
		return actions.order.capture().then((details: any): void => {
			const context = this._getCurrentDonationContext() as Context;
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
