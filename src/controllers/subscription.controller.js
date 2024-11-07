import db from "../models/index.js";
import JWT from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import moment from "moment-timezone";
import axios from "axios";
import chalk from "chalk";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { verifyAppleSignedData } from "../services/subscriptionService.js";
// import { fetchOrCreateUserToken } from "./plaid.controller.js";
// const fs = require("fs");
// var Jimp = require("jimp");
// require("dotenv").config();
const User = db.User;
const Op = db.Sequelize.Op;

import fetch from "node-fetch";
import base64 from "base-64";

//Credits_10x
// Credits_25x
// Credit_Unlimitedx
const CreditPoints = {
  Credits_10x: 10, // 10 points
  Credits_25x: 25, // 25 points
  BoostSoulmatch10: 1000000, // unlimited
};

const APPLE_RECEIPT_URL = "https://buy.itunes.apple.com/verifyReceipt"; // For production
const APPLE_SANDBOX_RECEIPT_URL =
  "https://sandbox.itunes.apple.com/verifyReceipt"; // For sandbox

const APPLE_SHARED_SECRET = process.env.APPLE_SHARED_SECRET; //'your_shared_secret'; // Replace with your actual shared secret

import UserProfileFullResource from "../resources/userprofilefullresource.js";

export const StoreReceipt = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      const { receipt, useSandbox } = req.body; // Ensure you pass the receipt and sandbox flag

      try {
        const originalTransactionId =
          await extractOriginalTransactionIdFromAppleReceipt(
            receipt,
            useSandbox
          );

        // Find or create the user by some unique identifier (e.g., email, userId)
        const user = await db.User.findOne({
          where: { email: req.body.email },
        });

        if (!user) {
          // return res.status(404).send('User not found');
          return res.send({
            status: false,
            message: "User not found",
            data: null,
          });
        }

        // Update the user with the originalTransactionId
        user.originalTransactionId = originalTransactionId;
        await user.save();

        let userRes = await UserProfileFullResource(user);
        return res.send({
          status: true,
          message: "User transaction id updated",
          data: userRes,
        });
      } catch (error) {
        return res.send({ status: false, message: error.message, data: null });
      }
    }
  });
};

//   const express = require('express');
// const router = express.Router();
// const { User, Subscription, SubscriptionHistory } = require('../models');

//Sandbox mode
export const AppleSubscriptionWebhook = async (req, res) => {
  const notification = req.body;
  console.log("Notficatiion rev cat ");
  if (!notification) {
    return res.status(400).send("No notification body");
  }

  try {
    let originalTransactionId;
    let productId;
    let purchaseDate;
    let expiresDate;
    let notificationType;
    let originalPurchaseDate;

    // Determine if notification is v1 or v2
    // if (notification.version && notification.version === "2.0") {
    // v2 notification
    // const signedTransactionInfo = notification.data.signedTransactionInfo;
    const data = await verifyAppleSignedData(notification.signedPayload);
    // console.log("Data after decoding ", data)
    notificationType = data.notificationType;

    const transactionInfo = await verifyAppleSignedData(
      data.data.signedTransactionInfo
    );

    console.log("Transaction info ", transactionInfo);
    if (
      typeof data.data.signedRenewalInfo !== undefined &&
      data.data.signedRenewalInfo != null
    ) {
      const renewalInfo = await verifyAppleSignedData(
        data.data.signedRenewalInfo
      );
      console.log("Renewal info ", renewalInfo);
    }
    originalTransactionId = transactionInfo.originalTransactionId;
    productId = transactionInfo.productId;
    purchaseDate = transactionInfo.purchaseDate;
    expiresDate = transactionInfo.expiresDate;

    let subtype = data.subtype;
    let environment = transactionInfo.environment;
    let price = transactionInfo.price;
    let currency = transactionInfo.currency;
    originalPurchaseDate = transactionInfo.originalPurchaseDate;
    console.log("Not Type ", notificationType);
    // } else {
    //     // v1 notification
    //     originalTransactionId = notification.latest_receipt_info.original_transaction_id;
    //     productId = notification.latest_receipt_info.product_id;
    //     purchaseDate = notification.latest_receipt_info.purchase_date;
    //     expiresDate = notification.latest_receipt_info.expires_date;
    //     notificationType = notification.notification_type;
    // }

    if (notificationType === "ONE_TIME_CHARGE") {
      //   let boost = await db.Boost.findOne({
      //     where: {
      //       originalPurchaseDate: originalPurchaseDate,
      //     },
      //   });
      //   if (!boost) {
      //     boost = await db.Boost.create({
      //       originalPurchaseDate: originalPurchaseDate,
      //       product: productId,
      //     });
      //   } else {
      //     boost.product = productId;
      //     let saved = boost.save();
      //   }
      //use productId to identify the points and add to the use profile
      return res.status(200).send("Notification received & processed");
    }

    // const user = await User.findOne({ where: { originalPurchaseDate } });

    // if (!user) {
    //     // return res.status(404).send('User not found');
    //     console.log("User not found")
    // }
    let subscription = await db.Subscription.findOne({
      where: { originalTransactionId: originalTransactionId, plan: productId },
    });
    let user = null;
    switch (notificationType) {
      case "INITIAL_BUY":
      case "DID_RENEW":
      case "SUBSCRIBED":
        if (!subscription) {
          subscription = await db.Subscription.create({
            // userId: user ? user.id : null,
            originalPurchaseDate: originalPurchaseDate,
            originalTransactionId: originalTransactionId,
            plan: productId,
            status: "active",
            startDate: new Date(purchaseDate),
            endDate: new Date(expiresDate),
          });
        } else {
          subscription.status = "renewed";

          subscription.originalPurchaseDate = originalPurchaseDate;
          subscription.endDate = new Date(expiresDate);
          await subscription.save();
        }
        await db.SubscriptionHistory.create({
          subscriptionId: subscription.id,
          nottype: notificationType,
          subtype: subtype,
          price: price,
          environment: environment,
          status: "renewed",
          currency: currency,
          changeDate: new Date(),
        });
        // user.subscriptionStatus = 'renewed';
        break;

      case "CANCEL":
        if (subscription) {
          subscription.status = "canceled";
          subscription.originalPurchaseDate = originalPurchaseDate;
          await subscription.save();
          await db.SubscriptionHistory.create({
            nottype: notificationType,
            subtype: subtype,
            subscriptionId: subscription.id,
            status: "canceled",
            currency: currency,
            changeDate: new Date(),
          });
          if (subscription.userId != null) {
            console.log("Getting user by id in auto renewal disabled webhook");
            user = await db.User.findByPk(subscription.userId);
            user.plan_status = "free";
            let saved = await user.save();
            console.log("User found for sub id ", subscription.userId);
          }
          // user.subscriptionStatus = 'canceled';
        }
        break;

      case "DID_CHANGE_RENEWAL_STATUS":
        if (subscription && subtype === "AUTO_RENEW_DISABLED") {
          subscription.status = "canceled";
          subscription.originalPurchaseDate = originalPurchaseDate;
          await subscription.save();
          await db.SubscriptionHistory.create({
            nottype: notificationType,
            subtype: subtype,
            subscriptionId: subscription.id,
            status: "canceled",
            price: price,
            currency: currency,
            environment: environment,
            changeDate: new Date(),
          });
          // let user = await db.User.findOne({
          //     where:{
          //         originalPurchaseDate: originalPurchaseDate
          //     }
          // })
          if (subscription.userId != null) {
            console.log("Getting user by id in auto renewal disabled webhook");
            user = await db.User.findByPk(subscription.userId);
            user.plan_status = "free";
            let saved = await user.save();
            console.log(
              "User found for sub id renew disabled",
              subscription.userId
            );
          }

          // user.subscriptionStatus = 'canceled';
        }
        break;

      case "EXPIRED":
        if (subscription) {
          subscription.status = "expired";
          subscription.originalPurchaseDate = originalPurchaseDate;
          await subscription.save();
          await db.SubscriptionHistory.create({
            nottype: notificationType,
            subtype: subtype,
            subscriptionId: subscription.id,
            status: "expired",
            price: price,
            currency: currency,
            environment: environment,
            changeDate: new Date(),
          });

          if (subscription.userId != null) {
            console.log("Getting user by id in auto renewal disabled webhook");
            user = await db.User.findByPk(subscription.userId);
            user.plan_status = "free";
            let saved = await user.save();
            console.log("User found for sub id expired", subscription.userId);
          }

          // user.subscriptionStatus = 'canceled';
        }
        break;

      // Add more cases as needed
    }

    // await user.save();
    res.status(200).send("Notification received");
  } catch (error) {
    console.error("Failed to process notification:", error);
    res.status(500).send("Failed to process notification");
  }
};

async function verifyReceipt(receipt, useSandbox = false) {
  const url = useSandbox ? APPLE_SANDBOX_RECEIPT_URL : APPLE_RECEIPT_URL;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      "receipt-data": receipt,
      password: APPLE_SHARED_SECRET,
    }),
  });
  console.log("Response from receipt verification ");
  const data = await response.json();
  console.log(data);
  if (!response.ok) {
    throw new Error("Failed to verify receipt");
  }

  return data;
}

async function extractOriginalTransactionIdFromAppleReceipt(
  receipt,
  useSandbox = false
) {
  try {
    const response = await verifyReceipt(receipt, useSandbox);

    if (response.status !== 0) {
      throw new Error("Receipt verification failed");
    }

    const latestReceiptInfo =
      response.latest_receipt_info || response.receipt.in_app;

    if (!latestReceiptInfo || latestReceiptInfo.length === 0) {
      throw new Error("No in-app purchase found in the receipt");
    }

    // Assuming we need the original transaction ID of the latest transaction
    const originalTransactionId = latestReceiptInfo[0].original_transaction_id;

    return originalTransactionId;
  } catch (error) {
    console.error("Failed to extract original transaction ID:", error);
    throw error;
  }
}

export const ValidateInAppPurchase = async (req, res) => {
  const { originalPurchaseDate, productId } = req.body;
  const REVENUECAT_API_KEY = process.env.RevenueCatApiKey;

  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      try {
        // Validate the receipt with RevenueCat
        // const response = await fetch(`https://api.revenuecat.com/v1/receipts`, {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //         'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
        //     },
        //     body: JSON.stringify({
        //         receipt: receipt,
        //         product_id: productId,
        //     }),
        // });

        // const data = await response.json();
        // console.log("Receipt validation from rev cat", data)
        let boost = await db.Boost.findOne({
          where: {
            originalPurchaseDate: originalPurchaseDate,
          },
        });

        if (boost) {
          // Purchase is valid, grant access
          boost.userId = authData.user.id;
          // const accessDuration = 3600 * 1000; // 1 hour in milliseconds
          // let boosted = await db.Boost.create({
          //     userId: authData.user.id,
          //     product: productId,

          // })
          let saved = boost.save();
          res.json({
            status: true,
            message: "Profile boosted ",
          });
        } else {
          res.status(400).json({
            status: false,
            message: "Purchase validation failed",
          });
        }
      } catch (error) {
        console.error("Error validating purchase:", error);
        res.status(500).json({
          status: false,
          message: "Server error",
        });
      }
    } else {
    }
  });
};

// module.exports = extractOriginalTransactionIdFromAppleReceipt;

// export const isProfileBoosted = async (userId) => {
//   try {
//     const currentTime = new Date().getTime();

//     const latestBoost = await db.Boost.findOne({
//       where: {
//         userId: userId,
//       },
//       order: [["originalPurchaseDate", "DESC"]],
//     });

//     if (!latestBoost) {
//       return false; // No boost found
//     }

//     // const purchaseDate = new Date(latestBoost.originalPurchaseDate).getTime();
//     const boostDuration = CreditPoints[latestBoost.product];

//     if (!boostDuration) {
//       console.error("Unknown product ID:", latestBoost.product);
//       return false; // Unknown product ID
//     }

//     const boostExpirationTime =
//       Number(latestBoost.originalPurchaseDate) + boostDuration;

//     // return currentTime <= boostExpirationTime;
//     console.log("Latest Boost ", latestBoost);
//     // const boostExpirationTime = new Date(latestBoost.originalPurchaseDate).getTime() + BOOST_DURATIONS[latestBoost.product];
//     console.log("Exp ", boostExpirationTime);
//     console.log("Current Time ", currentTime);

//     return currentTime < boostExpirationTime;
//   } catch (error) {
//     console.error("Error checking if profile is boosted:", error);
//     return false;
//   }
// };
