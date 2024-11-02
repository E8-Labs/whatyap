import db from "../models/index.js";
// import S3 from "aws-sdk/clients/s3.js";
import JWT from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
// import twilio from 'twilio';
import moment from "moment-timezone";
import axios from "axios";
import chalk from "chalk";
import nodemailer from "nodemailer";
import UserProfileFullResource from "../resources/userprofilefullresource.js";
import { ReviewTypes } from "../models/review/reviewtypes.js";
import ReviewResource from "../resources/reviewresource.js";
import { SettlementOfferTypes } from "../models/review/settlementoffertypes.js";
import MessageResource from "../resources/messageresource.js";

/**
 * Adds a new notification to the Notification table.
 *
 * @param {Object} params - The parameters for creating a notification.
 * @param {Object} params.fromUser - ID of the user who initiated the notification.
 * @param {Object} params.toUser - ID of the user who will receive the notification.
 * @param {string} params.type - Type of the notification.
 * @param {number} [params.productId] - Optional ID of the product related to the notification.
 *
 * @returns {Object} - The created notification object.
 */
export const addNotification = async ({
  fromUser,
  toUser,
  type,
  productId = null,
}) => {
  try {
    const notification = await db.Notification.create({
      fromUser: fromUser.id,
      toUser: toUser.id,
      type: type,
      productId: productId,
    });

    return notification;
  } catch (error) {
    console.error("Error adding notification:", error);
    throw new Error("Could not add notification");
  }
};
