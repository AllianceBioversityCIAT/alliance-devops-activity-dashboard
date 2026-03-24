import dotenv from "dotenv";
import serverlessExpress from "@vendia/serverless-express";
import { createApp } from "./app.js";

dotenv.config();

const app = createApp();
export const handler = serverlessExpress({ app });
