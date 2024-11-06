import express from "express";
import multer from "multer";

import { verifyJwtToken } from "../middleware/jwtmiddleware.js";
import {
  GetBusinessDashboardData,
  AddProfileView,
  SearchUsers,
  CustomersNearMe,
  AddCustomer,
  AddReview,
  DeleteSearch,
} from "../controllers/dashboard.controller.js";

const uploadFiles = multer().fields([
  { name: "media", maxCount: 1 },
  { name: "driver_license", maxCount: 1 },
]);

const uploadMedia = multer().fields([
  { name: "media", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

let BusinessRouter = express.Router();

BusinessRouter.get(
  "/businessDashboard",
  verifyJwtToken,
  GetBusinessDashboardData,
  AddCustomer,
  DeleteSearch
);

BusinessRouter.get("/searchCustomers", verifyJwtToken, SearchUsers);
BusinessRouter.post("/addProfileView", verifyJwtToken, AddProfileView);
BusinessRouter.post("/deleteSearch", verifyJwtToken, DeleteSearch);
BusinessRouter.post("/addCustomer", verifyJwtToken, uploadFiles, AddCustomer);
BusinessRouter.post("/addReview", verifyJwtToken, uploadFiles, AddReview);
BusinessRouter.get("/customersNear", verifyJwtToken, CustomersNearMe);

export default BusinessRouter;
