import Element from "sap/ui/core/Element";
import MessageType from "sap/ui/core/message/MessageType";
import UIComponent from "sap/ui/core/UIComponent";
import Messaging from "sap/ui/core/Messaging";
import Event from "sap/ui/base/Event";
import Message from "sap/ui/core/message/Message";
import InstanceManager from "sap/m/InstanceManager";
import Dialog from "sap/m/Dialog";
import MessageView from "sap/m/MessageView";
import MessageItem from "sap/m/MessageItem";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import Button from "sap/m/Button";
import Lib from "sap/ui/core/Lib";
import { ValueState } from "sap/ui/core/library";
import ODataModel from "sap/ui/model/odata/v2/ODataModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";

/**
 * @namespace zpaypal_donation
 */
export default class ErrorHandler extends Element {
	private _component: UIComponent;
	private _isMessageOpen: boolean = false;
	private _messages: Array<Message> = [];
	private _messageViewDialog: Dialog;

	public registerComponent(component: UIComponent) {
		this._component = component;
		Messaging.registerObject(this._component, true);
		this._registerODataModel();
	}

	private _registerODataModel() {
		const model = this._component.getModel() as ODataModel;
		if (model) {
			Messaging.registerMessageProcessor(model);
			model.attachMessageChange(this._onNewMessageFromV2Service, this);
		}
	}

	private _onNewMessageFromV2Service(event: Event) {
		const newMessages = event.getParameter("newMessages" as never) as Array<Message>;
		if (newMessages && newMessages.length) {
			newMessages.forEach((message: Message): void => this._addMessageToMessages(message));
		}
		if (this._messages.length && newMessages.length && newMessages.length > 0) {
			this._displayMessages();
		}
	}

	private _addMessageToMessages(message: Message) {
		this._messages.push(message);
	}

	private _displayMessages() {
		this._closeAllDialogs();

		if (this._messageViewDialog) {
			if (this._messageViewDialog.isOpen()) {
				this._setMessagesToMessageViewDialog();
				return;
			}
			this._messageViewDialog.close();
		}

		if (this._messages.length === 1) {
			this._displaySingleMessage();
		}

		if (this._messages.length > 1) {
			this._displayMessageView();
		}
	}

	private _closeAllDialogs() {
		if (this._isMessageOpen) {
			const dialogs = InstanceManager.getOpenDialogs() as Array<Dialog>;
			dialogs.forEach((dialog: Dialog): void => {
				if (dialog.toString() && dialog.toString().indexOf("sap.m.Dialog#errorHandlerMessageBox") !== -1) {
					dialog.destroy();
				}
			});
			this._isMessageOpen = false;
		}
	}

	private _setMessagesToMessageViewDialog() {
		const messageView: MessageView = this._createMessageView();
		this._messageViewDialog.removeAllContent();
		this._messageViewDialog.addContent(messageView);
	}

	private _createMessageView(): MessageView {
		return new MessageView({
			items: this._messages.map((message: Message): MessageItem => {
				return new MessageItem({
					title: message.getMessage() as string,
					groupName: "1" as string,
					type: message.getType() as MessageType
				});
			})
		});
	}

	private _displaySingleMessage() {
		if (Array.isArray(this._messages)) {
			const message: Message = this._messages.at(0) as Message;
			if (this._isMessageOpen || !message) {
				return;
			}
			switch (message.getType()) {
				case "Error":
					MessageBox.error(message.getMessage(), this._getMessageBoxConfiguration());
					this._isMessageOpen = true;
					break;
				case "Information":
					MessageBox.information(message.getMessage(), this._getMessageBoxConfiguration());
					this._isMessageOpen = true;
					break;
				case "Warning":
					MessageBox.warning(message.getMessage(), this._getMessageBoxConfiguration());
					this._isMessageOpen = true;
					break;
				case "Success":
					MessageToast.show(message.getMessage());
					this._messages = [];
					break;
				default:
					MessageBox.show(message.getMessage(), this._getMessageBoxConfiguration());
					this._isMessageOpen = true;
					break;
			}
		}
	}

	private _getMessageBoxConfiguration(): object {
		return {
			id: "errorHandlerMessageBox",
			actions: [MessageBox.Action.CLOSE],
			closeOnNavigation: false,
			onClose: (): void => {
				this._isMessageOpen = false;
				this._messages = [];
			}
		};
	}

	private _displayMessageView() {
		const severity: ValueState = this._getHardestSeverity();
		this._messageViewDialog = new Dialog({
			title: severity,
			state: severity,
			resizable: true,
			draggable: true,
			content: this._createMessageView(),
			closeOnNavigation: false,
			endButton: new Button({
				text: this._getCloseText(),
				press: (): void => {
					this._messages = [];
					this._messageViewDialog.close();
				}
			}),
			contentHeight: "300px",
			contentWidth: "35rem",
			verticalScrolling: false
		});
		this._messageViewDialog.open();
	}

	private _getHardestSeverity(): ValueState {
		let warningFound: boolean = false,
			informationFound: boolean = false,
			successFound: boolean = false;

		for (let i = 0; i < this._messages.length; i++) {
			switch (this._messages[i].getType()) {
				case "Success":
					successFound = true;
					break;
				case "Information":
					informationFound = true;
					break;
				case "Warning":
					warningFound = true;
					break;
				case "Error":
					return ValueState.Error;
				default:
					informationFound = true;
					break;
			}
		}
		if (warningFound) {
			return ValueState.Warning;
		}
		if (informationFound) {
			return ValueState.Information;
		}
		if (successFound) {
			return ValueState.Success;
		}
		return ValueState.None;
	}

	private _getCloseText(): string {
		const oLibraryResourceBundle = Lib.getResourceBundleFor("sap.m") as ResourceBundle;
		return oLibraryResourceBundle?.getText("MSGBOX_CLOSE") ?? "Close";
	}
}
