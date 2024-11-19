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
import NotificationResource from "../resources/notificationResource.js";

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

/**
 * Get all notifications for the authenticated user
 */
export const getUserNotifications = async (req, res) => {
  console.log("Get Notifications api");
  // Verify JWT token
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (error) {
      return res.status(403).json({ status: false, message: "Invalid token" });
    }

    try {
      let offset = Number(req.query.offset) || 0;
      // Extract user ID from authenticated data
      const userId = authData.user.id;

      // Fetch notifications for the authenticated user (toUser)
      const notifications = await db.Notification.findAll({
        where: { toUser: userId },
        include: [
          {
            model: db.User,
            as: "FromUser",
            attributes: ["id", "name", "username", "profile_image"], // Customize fields as needed
          },
        ],
        offset: offset,
        limit: 30,
        order: [["createdAt", "DESC"]],
      });

      // Format the response data
      const responseData = notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        fromUser: notification.FromUser,
        toUser: notification.toUser,
        productId: notification.productId,
        createdAt: notification.createdAt,
      }));

      let notRes = await NotificationResource(responseData);

      return res.status(200).json({
        status: true,
        data: notRes,
        message: "Notifications fetched successfully",
      });
    } catch (err) {
      console.error("Error fetching notifications:", err);
      return res.status(500).json({
        status: false,
        message: "Error fetching notifications",
        error: err.message,
      });
    }
  });
};
