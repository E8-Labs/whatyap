import express from "express";
import multer from "multer";

import { verifyJwtToken } from "../middleware/jwtmiddleware.js";
import {
  LoginUser,
  SendPhoneVerificationCode,
  VerifyPhoneCode,
  CheckPhoneExists,
  CheckUsernameExists,
  CheckEmailExists,
  GetProfileWithUsername,
  SendEmailVerificationCode,
  VerifyEmailCode,
  UpdateProfile,
  SendCustomSms,
  RegisterUser,
  UploadUserMedia,
  DeleteMedia,
  GetProfileMine,
  SearchHistory,
} from "../controllers/user.controller.js";

import {
  StoreReceipt,
  AppleSubscriptionWebhook,
  ValidateInAppPurchase,
} from "../controllers/subscription.controller.js";

import { getUserNotifications } from "../controllers/notification.controller.js";

const uploadFiles = multer().fields([
  { name: "media", maxCount: 1 },
  { name: "driver_license", maxCount: 1 },
]);

const uploadMedia = multer().fields([
  { name: "media", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

let UserRouter = express.Router();

UserRouter.post("/store_receipt", verifyJwtToken, StoreReceipt);
UserRouter.post("/validate_purchase", verifyJwtToken, ValidateInAppPurchase);
UserRouter.post("/subscription_event", AppleSubscriptionWebhook);

UserRouter.post("/sendCustomSms", SendCustomSms);

UserRouter.post("/login", LoginUser);
UserRouter.post("/register", uploadFiles, RegisterUser);

UserRouter.post("/updateProfile", verifyJwtToken, uploadFiles, UpdateProfile);
UserRouter.post("/checkPhoneNumber", CheckPhoneExists);
UserRouter.post("/checkUsernameExists", CheckUsernameExists);
UserRouter.get("/getProfileFromUsername", GetProfileWithUsername);
UserRouter.post("/checkEmailExists", CheckEmailExists);
UserRouter.post("/sendVerificationCode", SendPhoneVerificationCode);
UserRouter.post("/verifyCode", VerifyPhoneCode);

UserRouter.post("/sendVerificationEmail", SendEmailVerificationCode);
UserRouter.post("/verifyEmail", VerifyEmailCode);

UserRouter.post(
  "/upload_user_media",
  verifyJwtToken,
  uploadMedia,
  UploadUserMedia
);
UserRouter.post("/delete_media", verifyJwtToken, DeleteMedia);

UserRouter.get("/my_profile", verifyJwtToken, GetProfileMine);
UserRouter.get("/searchHistory", verifyJwtToken, SearchHistory);

UserRouter.get("/notifications", verifyJwtToken, getUserNotifications);

export default UserRouter;
