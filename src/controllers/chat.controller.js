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

const createOrFindChat = async (user, review) => {
  try {
    let customerId, businessId;

    // If the user is the customer, use his ID as customerId, otherwise as businessId
    if (user.role === "customer") {
      customerId = user.id;
      businessId = review.userId; // businessId is taken from the review's userId
    } else {
      businessId = user.id;
      customerId = review.customerId;
    }

    let firstReply = false;
    // Check if a chat exists for this reviewId
    let chat = await db.Chat.findOne({
      where: {
        reviewId: review.id,
        customerId,
        businessId,
      },
    });

    // If chat does not exist, create one
    if (!chat) {
      chat = await db.Chat.create({
        reviewId: review.id,
        customerId,
        businessId,
        lastMessage: "", // Initialize lastMessage empty
      });
      //if customer replies for the first time, then change the status to disputed
      review.reviewStatus = ReviewTypes.Disputed;
      let saved = await review.save();
      firstReply = true;
    }

    return { status: true, chat: chat, firstReply: firstReply };
  } catch (err) {
    return { status: false, message: err.message };
  }
};

export const sendMessage = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      try {
        const user = await db.User.findByPk(authData.user.id);
        if (!user) {
          return res
            .status(404)
            .send({ status: false, message: "No such user" });
        }

        const { reviewId, message } = req.body;
        let review = await db.Review.findByPk(reviewId);
        if (!review) {
          return res
            .status(404)
            .send({ status: false, message: "No such review" });
        }
        let messageType = "Text";
        // Find or create a chat
        let chat = await db.Chat.findOne({
          where: { reviewId, customerId: user.id },
        });
        let firstReply = false;
        if (!chat) {
          // If no chat exists, create one
          let createRes = await createOrFindChat(user, review);
          if (createRes && createRes.status) {
            chat = createRes.chat;
            firstReply = createRes.firstReply || false;
          }
        }

        console.log("Chat is ", chat);
        // Create a new message
        const newMessage = await db.Message.create({
          message,
          messageType: messageType,
          userId: user.id,
          chatId: chat.id,
        });

        // Update lastMessage field in chat
        chat.lastMessage = message;
        await chat.save();

        return res
          .status(200)
          .send({ status: true, message: newMessage, firstReply: firstReply });
      } catch (err) {
        console.log("Error ", err);
        return res.status(200).send({ status: false, message: err.message });
      }
    } else {
      return res.status(403).send({ status: false, message: "Unauthorized" });
    }
  });
};

export const loadChats = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      try {
        const user = await db.User.findByPk(authData.user.id);
        if (!user) {
          return res
            .status(404)
            .send({ status: false, message: "No such user" });
        }

        // Find all chats where the user is either the customer or the business
        const chats = await db.Chat.findAll({
          where: {
            [db.Sequelize.Op.or]: [
              { customerId: user.id },
              { businessId: user.id },
            ],
          },
          include: [
            { model: db.User, as: "Customer" },
            { model: db.User, as: "Business" },
            { model: db.Review, as: "Review" },
          ],
        });

        return res.status(200).send({ status: true, chats });
      } catch (err) {
        return res.status(500).send({ status: false, message: err.message });
      }
    } else {
      return res.status(403).send({ status: false, message: "Unauthorized" });
    }
  });
};

export const loadMessages = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    console.log("Error Auth", error);
    if (authData) {
      try {
        const user = await db.User.findByPk(authData.user.id);
        if (!user) {
          return res
            .status(404)
            .send({ status: false, message: "No such user" });
        }

        let chatId = req.query.chatId || null;
        let reviewId = req.query.reviewId || null;
        console.log("ChatId", chatId);
        console.log("reviewId", reviewId);
        // Find the chat by id
        let chat = await db.Chat.findByPk(chatId);
        if (chat == null) {
          chat = await db.Chat.findOne({
            where: {
              reviewId: reviewId,
            },
          });
        }
        if (!chat) {
          return res
            .status(404)
            .send({ status: false, message: "No such chat" + chatId });
        }

        // Ensure the user is either the customer or business in this chat
        if (chat.customerId !== user.id && chat.businessId !== user.id) {
          return res
            .status(403)
            .send({ status: false, message: "Unauthorized" });
        }

        // Load all messages for this chat
        const messages = await db.Message.findAll({
          where: { chatId: chat.id },
          //   include: [{ model: db.User, as: "User" }],
        });
        console.log("Loading messages for ", chat.id);
        let messagesRes = await MessageResource(messages);
        return res.status(200).send({ status: true, data: messagesRes });
      } catch (err) {
        return res.status(500).send({ status: false, message: err.message });
      }
    } else {
      return res.status(403).send({ status: false, message: "Unauthorized" });
    }
  });
};
