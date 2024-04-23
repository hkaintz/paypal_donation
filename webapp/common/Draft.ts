import { DraftAdministrativeData } from "./types";

export default class Draft {
  public static isMyOwn(draftAdministrativeData: DraftAdministrativeData): boolean {
    return draftAdministrativeData?.DraftIsProcessedByMe;
  }

  public static isUnsavedByMe(draftAdministrativeData: DraftAdministrativeData): boolean {
    return (
      !draftAdministrativeData?.DraftIsProcessedByMe && draftAdministrativeData?.DraftIsCreatedByMe
    );
  }

  public static isLockedByOtherUser(draftAdministrativeData: DraftAdministrativeData): boolean {
    return (
      !draftAdministrativeData?.DraftIsProcessedByMe && !!draftAdministrativeData?.InProcessByUser
    );
  }

  public static isUnsavedByOtherUser(draftAdministrativeData: DraftAdministrativeData): boolean {
    return (
      !draftAdministrativeData?.DraftIsProcessedByMe && !!draftAdministrativeData?.InProcessByUser
    );
  }
}
