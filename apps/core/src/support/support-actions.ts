import {
  SUPPORT_ACTION_MODE,
  SUPPORT_ACTION_STATUS,
  SUPPORT_OWNER_REF,
  type SupportActionRecord,
} from '@yaagi/contracts/support';

export type SupportOwnerActionSeam = (input: SupportActionRecord) => Promise<{
  accepted: boolean;
  evidenceRef?: string | null;
  reason?: string;
}>;

export type SupportOwnerActionSeams = Partial<Record<string, SupportOwnerActionSeam>>;

export type RouteSupportActionResult =
  | { accepted: true; action: SupportActionRecord }
  | {
      accepted: false;
      reason: 'owner_seam_unavailable' | 'owner_seam_refused' | 'support_does_not_execute';
      action: SupportActionRecord;
    };

const unavailableAction = (
  action: SupportActionRecord,
  reason: Extract<RouteSupportActionResult, { accepted: false }>['reason'],
): Extract<RouteSupportActionResult, { accepted: false }> => ({
  accepted: false,
  reason,
  action: {
    ...action,
    status: SUPPORT_ACTION_STATUS.UNAVAILABLE,
    evidenceRef: null,
  },
});

export const routeSupportAction = async (input: {
  action: SupportActionRecord;
  ownerSeams?: SupportOwnerActionSeams;
}): Promise<RouteSupportActionResult> => {
  const action = input.action;

  if (action.mode === SUPPORT_ACTION_MODE.HUMAN_ONLY) {
    return {
      accepted: true,
      action: {
        ...action,
        owner: action.owner || SUPPORT_OWNER_REF.HUMAN,
        status: SUPPORT_ACTION_STATUS.DOCUMENTED,
        evidenceRef: null,
      },
    };
  }

  const seam = input.ownerSeams?.[action.owner];
  if (!seam) {
    return unavailableAction(action, 'owner_seam_unavailable');
  }

  const result = await seam(action);
  if (!result.accepted) {
    return {
      accepted: false,
      reason: 'owner_seam_refused',
      action: {
        ...action,
        status: SUPPORT_ACTION_STATUS.FAILED,
        evidenceRef: result.evidenceRef ?? null,
      },
    };
  }

  if (!result.evidenceRef) {
    return unavailableAction(action, 'support_does_not_execute');
  }

  return {
    accepted: true,
    action: {
      ...action,
      status: SUPPORT_ACTION_STATUS.SUCCEEDED,
      evidenceRef: result.evidenceRef,
    },
  };
};
