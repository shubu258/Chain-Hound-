// Shared progress-event shape for the wallet-analysis + ENS-naming pipeline (dataRetrival.ts,
// analyzeWallet.ts, ensRegistrar.ts) so Routes/dataFetching.ts can stream live checkpoints to the
// frontend instead of the client seeing nothing until the whole request finishes.

export interface ProgressEvent {
  /** Machine-readable key, e.g. "subgraph:swaps" or "ens:counterparty:3/12". */
  step: string;
  /** Human-readable label for display, e.g. "Checking swaps". */
  label: string;
  status: 'start' | 'done' | 'error';
  detail?: string;
}

export type ProgressEmitter = (event: ProgressEvent) => void;

export const noopProgress: ProgressEmitter = () => {};
