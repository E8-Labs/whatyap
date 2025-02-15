import express from "express";
import multer from "multer";

import { verifyJwtToken } from "../middleware/jwtmiddleware.js";

import {
  HideFromPlatform,
  DeleteFromPlatform,
  AdminResolutions,
  DeleteAccount,
  SuspendAccount,
  ResolveOrReject,
  GetSuspendedUsers,
  UnSuspendAccount,
} from "../controllers/admin.controller.js";

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
AdminRouter.get("/suspendedUsers", verifyJwtToken, GetSuspendedUsers);
AdminRouter.get("/adminAnalytics", verifyJwtToken, AdminAnalytics);
AdminRouter.get("/adminResolutions", verifyJwtToken, AdminResolutions);
AdminRouter.post("/hideFromPlatform", verifyJwtToken, HideFromPlatform);
AdminRouter.post("/deleteFromPlatform", verifyJwtToken, DeleteFromPlatform);
AdminRouter.post("/resolveOrReject", verifyJwtToken, ResolveOrReject);

AdminRouter.post("/deleteAccount", verifyJwtToken, DeleteAccount);
AdminRouter.post("/suspendAccount", verifyJwtToken, SuspendAccount);
AdminRouter.post("/unSuspendAccount", verifyJwtToken, UnSuspendAccount);

export default AdminRouter;
