import express from "express";
import multer from "multer";

import { verifyJwtToken } from "../middleware/jwtmiddleware.js";

import {
  LoadDashboardData,
  AdminAnalytics,
} from "../controllers/admin.controller.js";

const uploadFiles = multer().fields([
  { name: "media", maxCount: 1 },
  { name: "driver_license", maxCount: 1 },
]);

const uploadMedia = multer().fields([
  { name: "media", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

let AdminRouter = express.Router();

AdminRouter.get("/adminDashboard", verifyJwtToken, LoadDashboardData);
AdminRouter.get("/adminAnalytics", verifyJwtToken, AdminAnalytics);

export default AdminRouter;
