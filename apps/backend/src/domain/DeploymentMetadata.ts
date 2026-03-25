/** Functional metadata for a deployment job (from DynamoDB). */
export type DeploymentMetadata = {
  jobName: string;
  applicationName: string;
  projectName: string;
  /** When set on the metadata record; used for enrichment when present. */
  environment?: string;
};
