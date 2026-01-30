// src/index.js
import express from "express";
import cors from "cors";
import uploadRoutes from "./routes/upload.routes.js";
import cloudfrontRoutes from "./routes/cloudfront.routes.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api", uploadRoutes, cloudfrontRoutes);

export default app;
