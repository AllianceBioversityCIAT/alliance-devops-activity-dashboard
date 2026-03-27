import type { DeploymentMetadata } from "../DeploymentMetadata.js";

export type MetadataJobNameFilters = {
  projectName?: string;
  environment?: string;
  applicationName?: string;
};

export interface DeploymentMetadataRepository {
  /** Query by partition key `job_name` only; first matching item in the partition. Returns null if not found or table unavailable. */
  getByJobName(jobName: string): Promise<DeploymentMetadata | null>;

  /**
   * Lists distinct job_name values from the metadata table (Scan; small table).
   * Optional filters narrow rows before projection. Empty/undefined filters = all jobs.
   */
  listJobNamesForFilters(filters: MetadataJobNameFilters): Promise<string[]>;
}
