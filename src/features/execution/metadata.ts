import type { RunContext } from "../simulation/core/types";

/** Build boundary attestation. Application and unchanged numerical engine have separate revisions. */
export interface BrowserMetadata {
  readonly version: 1;
  readonly verification: "verified" | "unverified";
  readonly reason: string | null;
  readonly context: RunContext | null;
  readonly code_input_sha256: Readonly<Record<string, string>>;
  readonly data_provenance_sha256: string | null;
  readonly application_git_revision: string | null;
  readonly application_input_sha256: Readonly<Record<string, string>>;
}
