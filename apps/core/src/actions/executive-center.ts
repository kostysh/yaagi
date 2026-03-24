import { randomUUID } from 'node:crypto';
import {
  decisionActionInputSchema,
  type BoundaryCheck,
  type DecisionActionInput,
  type ExecutiveVerdict,
} from '@yaagi/contracts/actions';
import { TICK_STATUS, type TickTerminalResult } from '@yaagi/contracts/runtime';
import type { RuntimeActionLogStore } from '@yaagi/db';
import type { ToolGateway } from './tool-gateway.ts';

export type ExecutiveCenter = {
  handleDecisionAction(input: DecisionActionInput): Promise<ExecutiveVerdict>;
};

type ExecutiveCenterOptions = {
  actionLogStore: Pick<RuntimeActionLogStore, 'appendActionLog'>;
  toolGateway: ToolGateway;
  createActionId?: () => string;
  reserveActionId?: (input: { tickId: string; actionId: string }) => Promise<void>;
};

const createAcceptedVerdict = (
  input: DecisionActionInput,
  actionId: string,
  verdictKind: Extract<ExecutiveVerdict['verdictKind'], 'conscious_inaction' | 'review_request'>,
  boundaryCheck: BoundaryCheck,
  resultJson: Record<string, unknown>,
): ExecutiveVerdict => ({
  accepted: true,
  actionId,
  verdictKind,
  boundaryCheck,
  resultJson: {
    summary: input.action.summary,
    ...resultJson,
  },
});

const createRefusalVerdict = (
  input: DecisionActionInput,
  actionId: string,
  boundaryCheck: BoundaryCheck,
  refusalReason: Extract<ExecutiveVerdict, { accepted: false }>['refusalReason'],
  detail: string,
): ExecutiveVerdict => ({
  accepted: false,
  actionId,
  verdictKind:
    input.action.type === 'schedule_job'
      ? 'schedule_job'
      : input.action.type === 'reflect'
        ? 'review_request'
        : input.action.type === 'none'
          ? 'conscious_inaction'
          : 'tool_call',
  boundaryCheck,
  refusalReason,
  detail,
});

export const executiveVerdictToResultJson = (verdict: ExecutiveVerdict): Record<string, unknown> =>
  verdict.accepted
    ? verdict.resultJson
    : {
        refusalReason: verdict.refusalReason,
        detail: verdict.detail,
      };

const createExecutiveAuditFailure = (
  actionId: string,
  detail: string,
): Error & TickTerminalResult =>
  Object.assign(new Error(detail), {
    status: TICK_STATUS.FAILED,
    summary: 'executive audit append failed',
    failureDetail: detail,
    actionId,
    continuityFlags: {
      executiveAuditFailed: {
        detail,
      },
    },
  });

export function createExecutiveCenter(options: ExecutiveCenterOptions): ExecutiveCenter {
  const createActionId = options.createActionId ?? randomUUID;

  return {
    async handleDecisionAction(rawInput: DecisionActionInput): Promise<ExecutiveVerdict> {
      const input = decisionActionInputSchema.parse(rawInput);
      const actionId = createActionId();
      await options.reserveActionId?.({
        tickId: input.tickId,
        actionId,
      });

      let verdict: ExecutiveVerdict;
      let rollback: (() => Promise<void>) | undefined;
      switch (input.action.type) {
        case 'none':
          verdict = createAcceptedVerdict(
            input,
            actionId,
            'conscious_inaction',
            {
              allowed: true,
              reason: 'the validated decision explicitly chose conscious inaction',
            },
            {
              outcome: 'conscious_inaction',
            },
          );
          break;
        case 'reflect':
          verdict = createAcceptedVerdict(
            input,
            actionId,
            'review_request',
            {
              allowed: true,
              reason: 'the validated decision explicitly requested review instead of execution',
            },
            {
              outcome: 'review_request',
            },
          );
          break;
        case 'tool_call':
        case 'schedule_job': {
          if (!input.action.tool) {
            verdict = createRefusalVerdict(
              input,
              actionId,
              {
                allowed: false,
                reason: 'validated execution actions require an allowlisted tool name',
                deniedBy: 'tool_name',
              },
              'unsupported_tool',
              `action type ${input.action.type} did not include a supported tool name`,
            );
            break;
          }

          const execution = await options.toolGateway.execute({
            tickId: input.tickId,
            actionId,
            toolName: input.action.tool,
            verdictKind: input.action.type === 'schedule_job' ? 'schedule_job' : 'tool_call',
            parametersJson: input.action.argsJson ?? {},
          });
          verdict = execution.verdict;
          rollback = execution.rollback;
          break;
        }
        default:
          verdict = createRefusalVerdict(
            input,
            actionId,
            {
              allowed: false,
              reason: `action type ${String(input.action.type)} is outside the delivered contract`,
              deniedBy: 'action_type',
            },
            'unsupported_action_type',
            `action type ${String(input.action.type)} is not supported by the executive seam`,
          );
      }

      try {
        await options.actionLogStore.appendActionLog({
          actionId: verdict.actionId,
          tickId: input.tickId,
          actionKind: verdict.verdictKind,
          toolName: input.action.tool ?? null,
          parametersJson: input.action.argsJson ?? {},
          boundaryCheckJson: verdict.boundaryCheck,
          resultJson: executiveVerdictToResultJson(verdict),
          success: verdict.accepted,
        });
      } catch (error) {
        if (rollback) {
          await rollback().catch(() => {});
        }

        throw createExecutiveAuditFailure(
          actionId,
          error instanceof Error ? error.message : String(error),
        );
      }

      return verdict;
    },
  };
}
