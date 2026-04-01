import type { Request, Response } from "express";
import { ComputeAvailabilitySummary } from "../../application/usecases/ComputeAvailabilitySummary.js";
import { DynamoIncidentsRepository } from "../../infrastructure/dynamodb/DynamoIncidentsRepository.js";
import { DynamoDeploymentMetadataRepository } from "../../infrastructure/dynamodb/DynamoDeploymentMetadataRepository.js";

export async function executiveAvailabilityHandler(req: Request, res: Response) {
  try {
    const from = typeof req.query.from === "string" ? req.query.from.trim() : "";
    const to = typeof req.query.to === "string" ? req.query.to.trim() : "";
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required (ISO strings)" });
    }
    if (Date.parse(from) > Date.parse(to)) {
      return res.status(400).json({ error: "from must be before or equal to to" });
    }

    const applicationName = typeof req.query.application === "string" ? req.query.application.trim() : undefined;
    const severity = typeof req.query.severity === "string" ? req.query.severity.trim() : undefined;
    const incidentType = typeof req.query.incident_type === "string" ? req.query.incident_type.trim() : undefined;
    const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
    const quarter = typeof req.query.quarter === "string" ? req.query.quarter.trim() : undefined;

    const usecase = new ComputeAvailabilitySummary(new DynamoIncidentsRepository(), new DynamoDeploymentMetadataRepository());
    const result = await usecase.execute({
      from,
      to,
      applicationName,
      severity,
      incidentType,
      status,
      quarter
    });
    return res.json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to compute availability summary" });
  }
}

