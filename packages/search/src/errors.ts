import { toolErrorContracts } from "@transcripts-mcp/contracts";

import { schemaVersion } from "./constants.ts";

const contract = toolErrorContracts.indexRebuildRequired;

/** Signals that indexed search is blocked until the caller explicitly rebuilds the local cache. */
export class IndexRebuildRequiredError extends Error {
  readonly code = contract.code;
  readonly expectedSchemaVersion = schemaVersion;
  readonly recovery = contract.recovery;

  constructor(readonly actualSchemaVersion: number | undefined) {
    super(contract.message);
    this.name = "IndexRebuildRequiredError";
  }
}
