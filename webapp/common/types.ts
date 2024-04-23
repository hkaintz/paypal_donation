import Context from "sap/ui/model/odata/v2/Context";

export interface DraftResponse {
  context: Context;
}

export interface FunctionImportResponse {
  results: [];
}

export interface SubmitChangesParameters {
  noBlockUI: boolean;
  noShowResponse: boolean;
  noShowSuccessToast: boolean;
  successMsg: string;
  failedMsg: string;
}

export interface Donation {
  __metadata:                    Metadata;
  Edit_ac:                       boolean;
  PayDonation_ac:                boolean;
  Delete_mc:                     boolean;
  Update_mc:                     boolean;
  DonationID:                    string;
  FirstName:                     string;
  LastName:                      string;
  Value:                         string;
  Currency:                      string;
  Paid:                          boolean;
  LocalLastChangedAt:            Date;
  HasDraftEntity:                boolean;
  DraftEntityCreationDateTime:   null;
  DraftEntityLastChangeDateTime: null;
  HasActiveEntity:               boolean;
  IsActiveEntity:                boolean;
  DraftAdministrativeData:       string | DraftAdministrativeData;
  SiblingEntity:                 string | object;
}

export interface DraftAdministrativeData {
  __metadata:                   Metadata;
  DraftUUID:                    string;
  DraftEntityType:              string;
  CreationDateTime:             Date;
  CreatedByUser:                string;
  LastChangeDateTime:           Date;
  LastChangedByUser:            string;
  DraftAccessType:              string;
  ProcessingStartDateTime:      Date;
  InProcessByUser:              string;
  DraftIsKeptByUser:            boolean;
  EnqueueStartDateTime:         Date;
  DraftIsCreatedByMe:           boolean;
  DraftIsLastChangedByMe:       boolean;
  DraftIsProcessedByMe:         boolean;
  CreatedByUserDescription:     string;
  LastChangedByUserDescription: string;
  InProcessByUserDescription:   string;
}

export interface Metadata {
  id:   string;
  uri:  string;
  type: string;
  etag: string;
}

export interface PayPalPurchaseOrder {
  purchase_units: PurchaseUnit[];
}
export interface PayPalAction {
  order: {
    create(purchaseOrder: PayPalPurchaseOrder): Promise<object>,
    capture(): Promise<object>,
  },
  resolve: Function,
  reject: Function
}

export interface PurchaseUnit {
  amount: Amount;
}

export interface Amount {
  currency_code: string;
  value:         string;
}
