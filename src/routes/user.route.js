import express from "express";
import multer from "multer";

import { verifyJwtToken } from "../middleware/jwtmiddleware.js";
import {
  LoginUser,
  SendPhoneVerificationCode,
  VerifyPhoneCode,
  CheckPhoneExists,
  CheckDriverLicenseExists,
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
  SocialLogin,
} from "../controllers/user.controller.js";

import {
  StoreReceipt,
  AppleSubscriptionWebhook,
  ValidateInAppPurchase,
  PurchaseCredits,
} from "../controllers/subscription.controller.js";

import {
  getUserNotifications,
  ReadAllNotificaitons,
} from "../controllers/notification.controller.js";

import {
  AddCard,
  GetUserPaymentSources,
  DeleteCard,
  // BuyProduct,
  MakeDefaultPaymentMethod,
  PaySettlement,
} from "../controllers/paymentController.js";

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
UserRouter.post("/SocialLogin", uploadFiles, SocialLogin);

UserRouter.post("/updateProfile", verifyJwtToken, uploadFiles, UpdateProfile);
UserRouter.post("/checkPhoneNumber", CheckPhoneExists);
UserRouter.post("/checkDriverLicenseExists", CheckDriverLicenseExists);
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
UserRouter.post("/readNotifications", verifyJwtToken, ReadAllNotificaitons);
UserRouter.post(
  "/purchaseCredits",
  verifyJwtToken,
  uploadFiles,
  PurchaseCredits
);

//Payment
UserRouter.post("/add_card", verifyJwtToken, uploadFiles, AddCard);
UserRouter.post(
  "/make_default",
  verifyJwtToken,
  uploadFiles,
  MakeDefaultPaymentMethod
);
UserRouter.post("/paySettlement", verifyJwtToken, uploadFiles, PaySettlement);
UserRouter.post("/delete_card", verifyJwtToken, uploadFiles, DeleteCard);
// UserRouter.get(
//   "/get_transactions",
//   verifyJwtToken,
//   uploadFiles,
//   GetTransactions
// );
UserRouter.get(
  "/list_cards",
  verifyJwtToken,
  uploadFiles,
  GetUserPaymentSources
);

export default UserRouter;
