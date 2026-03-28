import express from "express";
import cors from "cors";
import { createRouter } from "./interfaces/http/router.js";

export function createApp() {
  const app = express();

  // Normalize stage prefix (/dev, /prod) when API Gateway forwards stage in path
  app.use((req, _res, next) => {
    const stage = (process.env.ENVIRONMENT_NAME ?? "").trim();
    if (stage && req.url.startsWith(`/${stage}/`)) {
      req.url = req.url.slice(stage.length + 1);
    } else if (stage && req.url === `/${stage}`) {
      req.url = "/";
    }
    next();
  });

  app.use(
    cors({
      origin: [/^http:\/\/localhost:\d+$/],
      credentials: false,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  );
  app.use(express.json());
  app.use(createRouter());

  return app;
}
