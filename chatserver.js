import express from "express";
import { Server } from "socket.io";
import path from "path";
import fs from "fs";
// import { OpenAI } from "openai"; // Adjust import based on your OpenAI SDK version
import http from "http"; // Importing http module
import dotenv from "dotenv";
import db from "./src/models/index.js"; // Adjust the import based on your directory structure
import JWT from "jsonwebtoken";
import { addNotification } from "./src/controllers/notification.controller.js";
import { NotificationType } from "./src/models/notifications/notificationtypes.js";
import MessageResource from "./src/resources/messageresource.js";

import {
  uploadMedia,
  createThumbnailAndUpload,
} from "./src/utils/generateThumbnail.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("A user connected: ", socket.id);

  //React on message
  socket.on("reactOnMessage", async (data) => {
    console.log("Emoji received ", data, "Type:", typeof data);
    let token = data.token;
    JWT.verify(token, process.env.SecretJwtKey, async (err, authData) => {
      if (err) {
        console.log("Invalid token", err);
        return socket.emit("receiveMessage" + message.chatId, {
          status: false,
          message: "Unauthorized: Invalid token",
        });
      }

      const userid = authData.user.id;
      let user = await db.User.findByPk(userid);
      console.log("User is ", userid);
      let emoji = data.emoji;
      let messageId = data.messageId;
      let message = await db.Message.findByPk(messageId);
      if (message) {
        message.emoji = emoji;
        let saved = message.save();
        console.log("Emitting data to ", message.chatId);
        console.log("Emitting message", message);
        let res = await MessageResource(message);
        socket.emit("receiveMessage" + message.chatId, {
          status: true,
          message: res,
        });
      } else {
        socket.emit("receiveMessage" + message.chatId, {
          status: false,
          message: "No such message",
        });
      }
    });
  });

  socket.on("sendMessage", async (message) => {
    console.log("Message received ", message, "Type:", typeof message);

    // Verify JWT Token
    const { chatId, messageContent, file, audio } = message; // Added `audio`
    let dataFromSocket = { chatId, messageContent, file, audio };
    console.log("DataFromSocket", dataFromSocket);
    let token = message.token;
    JWT.verify(token, process.env.SecretJwtKey, async (err, authData) => {
      if (err) {
        console.log("Invalid token", err);
        return socket.emit("receiveMessage" + chatId, {
          status: false,
          message: "Unauthorized: Invalid token",
        });
      }

      const userid = authData.user.id;
      let user = await db.User.findByPk(userid);
      console.log("User is ", userid);
      try {
        let mediaUrl = null;
        let voiceUrl = null;
        let messageType = "Text";

        // Handle media file upload
        if (file) {
          const mediaBuffer = Buffer.from(file.buffer, "base64"); // Assuming `file.buffer` is provided
          const mediaExt = path.extname(file.originalname);
          const mediaFilename = `${Date.now()}${mediaExt}`;

          mediaUrl = await uploadMedia(
            `media_${mediaFilename}`,
            mediaBuffer,
            file.mimetype,
            "chat_media"
          );
          console.log("Meida", mediaUrl);
          messageType = "Media";
        }

        // Handle audio file upload
        if (audio) {
          console.log("Audio file there.");
          const audioBuffer = Buffer.from(audio.buffer, "base64"); // Assuming `audio.buffer` is provided
          const audioExt = path.extname(audio.originalname);
          const audioFilename = `${Date.now()}${audioExt}`;

          voiceUrl = await uploadMedia(
            `audio_${audioFilename}`,
            audioBuffer,
            audio.mimetype,
            "chat_audio"
          );
          console.log("Voice ", voiceUrl);

          messageType = "Voice";
        }

        // Retrieve the chat
        const chat = await db.Chat.findByPk(chatId);
        let review = await db.Review.findByPk(chat.reviewId);

        // Ensure the user is either the business or the customer in the chat
        if (
          chat &&
          (chat.businessId === userid || chat.customerId === userid)
        ) {
          // Save the message to the database
          const savedMessage = await db.Message.create({
            message: messageContent || "",
            media: mediaUrl,
            voice: voiceUrl,
            chatId,
            userId: userid,
            messageType: messageType,
          });

          // Broadcast the message to both users in the chat
          let res = await MessageResource(savedMessage);
          socket.emit("receiveMessage" + chatId, {
            status: true,
            message: res,
          });

          console.log("Saved message to database:", savedMessage);

          let otherUserId = chat.customerId;
          if (otherUserId == user.id) {
            otherUserId = chat.businessId;
            // current user is customer
            review.newActivityByCustomer = true;
            review.newActivityByBusiness = false;
            await review.save();
          } else {
            // current user is business
            review.newActivityByBusiness = true;
            review.newActivityByCustomer = false;
            await review.save();
          }

          if (otherUserId == user.id) {
            otherUserId = chat.businessId;
          }
          let otherUser = await db.User.findByPk(otherUserId);
          try {
            await addNotification({
              fromUser: user,
              toUser: otherUser,
              type: NotificationType.TypeNewMessage,
              productId: savedMessage.id, // Optional
            });
          } catch (error) {
            console.log("Error sending notification", error);
          }

          // Optionally update the lastMessage field in Chat model
          await chat.update({ lastMessage: messageContent || "" });
        } else {
          console.log("Chat not found or user not authorized", chatId);
          socket.emit("receiveMessage" + chatId, {
            status: false,
            message: "Chat not found or unauthorized",
          });
        }
      } catch (error) {
        console.log("Error :", error);
        socket.emit("receiveMessage" + chatId, {
          status: false,
          message: error.message,
        });
      }
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
  });
});

server.listen(8004, "0.0.0.0", () => {
  console.log("Server is running on port 8004");
});
