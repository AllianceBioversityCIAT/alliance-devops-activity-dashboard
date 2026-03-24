import express from "express";
import cors from "cors";
import { createRouter } from "./interfaces/http/router.js";

export function createApp() {
  const app = express();

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
