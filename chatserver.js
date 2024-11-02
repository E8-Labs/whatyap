import express from "express";
import { Server } from "socket.io";
// import { OpenAI } from "openai"; // Adjust import based on your OpenAI SDK version
import http from "http"; // Importing http module
import dotenv from "dotenv";
import db from "./src/models/index.js"; // Adjust the import based on your directory structure
import JWT from "jsonwebtoken";
import { addNotification } from "./src/controllers/notification.controller.js";
import { NotificationType } from "./src/models/notifications/notificationtypes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

io.on("connection", (socket) => {
  console.log("A user connected: ", socket.id);

  socket.on("sendMessage", async (message) => {
    console.log("Message received ", message, "Type:", typeof message);

    // Verify JWT Token
    let token = message.token;
    JWT.verify(token, process.env.SecretJwtKey, async (err, authData) => {
      if (err) {
        console.log("Invalid token", err);
        return socket.emit("receiveMessage", {
          status: false,
          message: "Unauthorized: Invalid token",
        });
      }

      const userid = authData.user.id;
      let user = await db.User.findByPk(userid);
      console.log("User is ", userid);
      try {
        const { chatId, messageContent } = message;

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
            message: messageContent,
            chatId,
            userId: userid,
            messageType: "Text", // or any other type as per your use case
          });

          // Broadcast the message to both users in the chat
          io.to(chatId).emit("receiveMessage", {
            status: true,
            message: JSON.stringify(savedMessage),
          });

          console.log("Saved message to database:", savedMessage);

          let otherUserId = chat.customerId;
          if (otherUserId == user.id) {
            otherUserId = chat.businessId;
            //current user is customer
            review.newActivityByCustomer = true;
            review.newActivityByBusiness = false;
            let saved = await review.save();
          } else {
            //current user is business
            review.newActivityByBusiness = true;
            review.newActivityByCustomer = false;
            let saved = await review.save();
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
            console.log("Error sending not sendmessage chat.controller", error);
          }

          // Optionally update the lastMessage field in Chat model
          await chat.update({ lastMessage: messageContent });
        } else {
          console.log("Chat not found or user not authorized", chatId);
          socket.emit("receiveMessage", {
            status: false,
            message: "Chat not found or unauthorized",
          });
        }
      } catch (error) {
        console.log("Error :", error);
        socket.emit("receiveMessage", {
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
