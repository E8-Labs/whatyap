import express from "express";
import multer from "multer";

import { verifyJwtToken } from "../middleware/jwtmiddleware.js";
import {
  LoadReviews,
  DisputeReview,
  SendSettlementOffer,
  PaySettlementOffer,
} from "../controllers/review.controller.js";

import {
  sendMessage,
  loadChats,
  loadMessages,
  CreateChat,
} from "../controllers/chat.controller.js";

const uploadFiles = multer().fields([
  { name: "media", maxCount: 1 },
  { name: "driver_license", maxCount: 1 },
]);

const uploadMedia = multer().fields([
  { name: "media", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

let ReviewRouter = express.Router();

ReviewRouter.post("/createChat", verifyJwtToken, CreateChat);

ReviewRouter.get("/loadReviews", verifyJwtToken, uploadFiles, LoadReviews);
ReviewRouter.post("/disputeReview", verifyJwtToken, uploadFiles, DisputeReview);
ReviewRouter.post(
  "/paySettlementOffer",
  verifyJwtToken,
  uploadFiles,
  PaySettlementOffer
);
ReviewRouter.post(
  "/sendSettlementOffer",
  verifyJwtToken,
  uploadFiles,
  SendSettlementOffer
);

//Chat & Messages
ReviewRouter.post("/sendMessage", verifyJwtToken, sendMessage);
ReviewRouter.get("/loadMessages", verifyJwtToken, loadMessages);
ReviewRouter.get("/loadChats", verifyJwtToken, loadChats);
export default ReviewRouter;
