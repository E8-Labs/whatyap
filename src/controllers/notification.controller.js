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
import {
  createNotificaiton,
  getSubtitleForNotification,
} from "../utils/notificationutility.js";
import { Expo } from "expo-server-sdk";

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

// Create a new Expo SDK client

export const sendNot = async (to, title, body, data) => {
  let expo = new Expo();
  const message = {
    to: to, //"ExponentPushToken[_pZ2Y6LPv7S9gKi2lJwzif]",
    sound: "default",
    title: title, //'Test Notification',
    body: body, //'This is a test notification message',
    data: data, //{ message: 'This is a test notification message' },
  };

  try {
    // Send the notification
    let receipts = await expo.sendPushNotificationsAsync([message]);
    //console.log(receipts);
    return {
      status: true,
      message: "Notification sent successfully",
      data: receipts,
    };
  } catch (error) {
    console.error(error);
    return {
      status: false,
      message: "Failed to send notification",
      error: error.message,
    };
    // res.status(500).send({ status: false, message: 'Failed to send notification', error: error.message });
  }
};

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

    let sent = await createNotificaiton(
      fromUser.id,
      toUser.id,
      productId,
      type,
      getSubtitleForNotification(type, fromUser),
      { data: notification }
    );

    console.log("Sent not to admin ", sent);

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

export const ReadAllNotificaitons = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let userId = authData.user.id;
      let user = await db.User.findOne({
        where: {
          id: userId,
        },
      });

      let done = await db.Notification.update(
        {
          isRead: true,
        },
        {
          where: {
            userId: user.id,
          },
        }
      );
      let resource = await UserProfileFullResource(user);
      res.send({
        status: true,
        message: "User notifications read",
        data: resource,
      });
    }
  });
};
