import type { DeploymentMetadata } from "../DeploymentMetadata.js";

export interface DeploymentMetadataRepository {
  /** Query by partition key `job_name` only; first matching item in the partition. Returns null if not found or table unavailable. */
  getByJobName(jobName: string): Promise<DeploymentMetadata | null>;
}
