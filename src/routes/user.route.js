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
} from "../controllers/user.controller.js";

const uploadFiles = multer().fields([
  { name: "media", maxCount: 1 },
  { name: "driver_license", maxCount: 1 },
]);

const uploadMedia = multer().fields([
  { name: "media", maxCount: 1 },
  { name: "thumbnail", maxCount: 1 },
]);

let UserRouter = express.Router();

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

export default UserRouter;
