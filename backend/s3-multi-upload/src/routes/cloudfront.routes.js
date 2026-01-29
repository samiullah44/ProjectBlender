import express from "express";
import { getSignedUrlController } from "../controllers/cloudfrontController.js";

const router = express.Router();

// POST /api/cloudfront/signed-url
router.post("/signed-url", getSignedUrlController);

export default router;
