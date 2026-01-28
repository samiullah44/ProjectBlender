import express from "express";
import {
  initiateUpload,
  completeUpload,
} from "../controllers/upload.controller.js";

const router = express.Router();

router.post("/initiate-upload", initiateUpload);
router.post("/complete-upload", completeUpload);

export default router;
