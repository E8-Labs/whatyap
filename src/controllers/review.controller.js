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
import { addNotification } from "./notification.controller.js";
import { NotificationType } from "../models/notifications/notificationtypes.js";
import * as stripe from "../services/stripe.js";
// export const LoadReviews = async (req, res) => {
//   JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
//     if (authData) {
//       console.log("Auth User Id ", authData.user.id);
//       let user = await db.User.findByPk(authData.user.id);
//       if (!user) {
//         return res.send({ status: false, message: "No such user" });
//       }
//       let offset = Number(req.query.offset || 0) || 0;
//       let reviewStatus = req.query.reviewStatus || ReviewTypes.Posted;

//       let userId = user.id;
//       if (req.query.userId) {
//         console.log("UserId found ", userId);
//         userId = req.query.userId;
//         user = await db.User.findByPk(userId);
//       }
//       console.log("Loading reviews for ", authData.user.id);
//       let condition = {
//         reviewStatus: reviewStatus,
//       };

//       if (reviewStatus == ReviewTypes.Active) {
//         condition = {
//           [db.Sequelize.Op.or]: [
//             { reviewStatus: ReviewTypes.Active },
//             { reviewStatus: ReviewTypes.Disputed },
//           ],

//           createdAt: {
//             [db.Sequelize.Op.gt]: new Date(
//               new Date() - 7 * 24 * 60 * 60 * 1000
//             ), // More than 7 days old
//           },
//         };
//       } else if (reviewStatus == ReviewTypes.Settlement) {
//         // fetch all active which only have
//         condition = {
//           [db.Sequelize.Op.or]: [
//             { reviewStatus: ReviewTypes.Active },
//             { reviewStatus: ReviewTypes.Disputed },
//           ],
//           settlementOffer: true,
//         };
//       } else {
//         //Fetch the past and resolved reviews. We will be running cron job to mark the reviews past if no activity within 48 hours.
//         condition = {
//           [db.Sequelize.Op.or]: [
//             { reviewStatus: ReviewTypes.Past },
//             { reviewStatus: ReviewTypes.Resolved },
//             { reviewStatus: ReviewTypes.ResolvedByAdmin },
//             { reviewStatus: ReviewTypes.ResjectedByAdmin },
//             {
//               createdAt: {
//                 [db.Sequelize.Op.lt]: new Date(
//                   new Date() - 7 * 24 * 60 * 60 * 1000
//                 ), // More than 7 days old
//               },
//             },
//           ],
//         };
//       }

//       if (user.role == "customer") {
//         condition = { ...condition, customerId: userId };
//       } else {
//         condition = { ...condition, userId: userId };
//       }
//       if (req.query.userId) {
//         // if user wants to review of the other business or customer then this api would be called
//         if (user.role == "customer") {
//           condition = { ...condition, customerId: userId };
//         } else {
//           condition = { ...condition, userId: userId };
//         }
//       }

//       console.log("Condition is ", condition);

//       let reviews = await db.Review.findAll({
//         where: condition,
//         offset: offset,
//         limit: 20,
//         order: [["createdAt", "DESC"]],
//       });

//       let reviewRes = [];
//       if (reviews) {
//         console.log("Reviews found ", reviews.length);
//         reviewRes = await ReviewResource(reviews);
//       }

//       return res.send({
//         status: true,
//         message: "All reviews",
//         data: reviewRes,
//       });
//     }
//   });
// };

export const LoadReviews = async (req, res) => {
  try {
    JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
      if (!authData) {
        return res.status(403).send({ status: false, message: "Unauthorized" });
      }

      console.log("Auth User Id ", authData.user.id);
      let user = await db.User.findByPk(authData.user.id);
      if (!user) {
        return res.send({ status: false, message: "No such user" });
      }

      let offset = Number(req.query.offset || 0) || 0;
      let reviewStatus = req.query.reviewStatus || ReviewTypes.Posted;
      let userId = req.query.userId || user.id;

      if (req.query.userId) {
        console.log("UserId found ", req.query.userId);
        user = await db.User.findByPk(userId);
      }

      console.log("Loading reviews for ", userId);

      // Define time range for past reviews
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      let condition = {};

      if (reviewStatus === ReviewTypes.Active) {
        // Keep Active Reviews: If disputed or message was sent in the first 7 days
        condition = {
          [db.Sequelize.Op.or]: [
            {
              reviewStatus: ReviewTypes.Active,
              createdAt: { [db.Sequelize.Op.gte]: sevenDaysAgo }, // Less than 7 days old
            },
            {
              reviewStatus: ReviewTypes.Disputed,
              createdAt: { [db.Sequelize.Op.gte]: sevenDaysAgo }, // Disputed within 7 days
            },
            {
              id: {
                [db.Sequelize.Op.in]: db.Sequelize.literal(`
                  (SELECT DISTINCT chat.reviewId 
                   FROM Messages msg 
                   JOIN Chats chat ON chat.id = msg.chatId 
                   WHERE msg.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY))
                `),
              }, // If a message was sent within the first 7 days
            },
          ],
        };
      } else if (reviewStatus === ReviewTypes.Settlement) {
        // Fetch all active or disputed reviews with a settlement offer
        condition = {
          [db.Sequelize.Op.or]: [
            { reviewStatus: ReviewTypes.Active },
            { reviewStatus: ReviewTypes.Disputed },
          ],
          settlementOffer: true,
        };
      } else {
        // Past Reviews: Created >7 days ago and (Not disputed OR No messages sent)
        condition = {
          [db.Sequelize.Op.or]: [
            {
              reviewStatus: {
                [db.Sequelize.Op.in]: [
                  ReviewTypes.Past,
                  ReviewTypes.Resolved,
                  ReviewTypes.ResolvedByAdmin,
                  ReviewTypes.RejectedByAdmin,
                ],
              },
            },
            {
              createdAt: { [db.Sequelize.Op.lt]: sevenDaysAgo }, // More than 7 days old
              reviewStatus: { [db.Sequelize.Op.ne]: ReviewTypes.Disputed },
              id: {
                [db.Sequelize.Op.notIn]: db.Sequelize.literal(`
                  (SELECT DISTINCT chat.reviewId 
                   FROM Messages msg 
                   JOIN Chats chat ON chat.id = msg.chatId 
                   WHERE msg.createdAt >= DATE_SUB(NOW(), INTERVAL 7 DAY))
                `),
              }, // No messages sent within 7 days
            },
          ],
        };
      }

      // Filter by user role
      if (user.role === "customer") {
        condition = { ...condition, customerId: userId };
      } else {
        condition = { ...condition, userId: userId };
      }

      console.log("Condition is ", JSON.stringify(condition, null, 2));

      let reviews = await db.Review.findAll({
        where: condition,
        offset: offset,
        limit: 20,
        order: [["createdAt", "DESC"]],
      });

      let reviewRes = [];
      if (reviews.length > 0) {
        console.log("Reviews found ", reviews.length);
        reviewRes = await ReviewResource(reviews);
      }

      return res.send({
        status: true,
        message: "All reviews",
        data: reviewRes,
      });
    });
  } catch (err) {
    console.error("Error loading reviews:", err);
    return res.status(500).send({ status: false, message: "Server error" });
  }
};

export const DisputeReview = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let disputeReason = req.body.reason || null;
      console.log("Dispute reason is ", disputeReason);
      let user = await db.User.findByPk(authData.user.id);
      if (!user) {
        return res.send({ status: false, message: "No such user" });
      }

      let reviewId = req.body.reviewId; // sent by customer
      let review = await db.Review.findByPk(reviewId);
      if (review) {
        review.reviewStatus = ReviewTypes.Disputed;
        review.disputeReason = disputeReason;
        let saved = await review.save();
        if (saved) {
          let otherUserId = review.userId; //business
          let otherUser = await db.User.findByPk(otherUserId);

          if (otherUserId == user.id) {
            //current user is business
            review.newActivityByBusiness = true;
            review.newActivityByCustomer = false;
            let saved = await review.save();
          } else {
            //current user is customer
            review.newActivityByCustomer = true;
            review.newActivityByBusiness = false;
            let saved = await review.save();
          }

          try {
            await addNotification({
              fromUser: user,
              toUser: otherUser,
              type: NotificationType.Disagreement,
              productId: review.id, // Optional
            });

            let adminUser = await db.User.findOne({
              where: {
                role: "admin",
              },
            });
            await addNotification({
              fromUser: user,
              toUser: adminUser,
              type: NotificationType.Disagreement,
              productId: review.id, // Optional
            });
          } catch (error) {
            console.log("Error sending disagreement not ", error);
          }

          let reviewRes = await ReviewResource(review);

          return res.send({
            status: true,
            message: "Review dispute sent",
            data: reviewRes,
          });
        }
      } else {
        res.send({ status: false, message: "No such review" });
      }
    }
  });
};

export const PaySettlementOffer = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);

      if (!user) {
        return res.send({ status: false, message: "No such user" });
      }

      let settlementOfferId = req.body.settlementOfferId;
      let reviewId = req.body.reviewId; // sent by customer

      let review = await db.Review.findByPk(reviewId);
      let settlementOffer = await db.SettlementOffer.findByPk(
        settlementOfferId
      );
      if (review && settlementOffer) {
        let settlement = settlementOffer;
        let amount = settlement.amount;
        let taxPer = 5; //5%
        let taxAmount = (amount * 5) / 100;
        let totalAmount = amount + taxAmount;

        let charge = await stripe.ChargeCustomer(totalAmount, user);
        if (charge.status == true) {
          let created = await db.SettlementPayments.create({
            userId: user.id,
            tax: taxAmount,
            settlementOfferAmount: amount,
            totalAmount: totalAmount,
            status: "success",
            data: JSON.stringify(charge.payment),
            settlementOfferId: settlement.id,
            paymentMethodId: charge.paymentMethodId,
          });

          // settlement.status = "paid";
          review.reviewStatus = ReviewTypes.Resolved;
          settlement.status = SettlementOfferTypes.Paid;
          let offerSaved = await settlement.save();
          let saved = await review.save();

          if (saved) {
            let otherUserId = review.userId;
            let otherUser = await db.User.findByPk(otherUserId);

            try {
              await addNotification({
                fromUser: user,
                toUser: otherUser,
                type: NotificationType.SettlementAccepted,
                productId: review.id, // Optional
              });

              let adminUser = await db.User.findOne({
                where: {
                  role: "admin",
                },
              });
              await addNotification({
                fromUser: user,
                toUser: adminUser,
                type: NotificationType.SettlementAmountPaid,
                productId: review.id, // Optional
              });
            } catch (error) {
              console.log(
                "Error sending not sendmessage chat.controller",
                error
              );
            }
            let reviewRes = await ReviewResource(review);
            return res.send({
              status: true,
              message: "Review resolved and settlement offer paid",
              data: reviewRes,
            });
          }
          return res.send({
            status: true,
            message: "Payment successfull",
            // clientSecret: paymentIntent.client_secret,
          });
        } else {
          let created = await db.SettlementPayments.create({
            userId: user.id,
            tax: taxAmount,
            settlementOfferAmount: amount,
            totalAmount: totalAmount,
            status: "failed",
            data: JSON.stringify(charge.payment),
            settlementOfferId: settlement.id,
          });
          console.log(charge);
          return res.send({
            status: false,
            message: "Payment was not processed",
            // clientSecret: paymentIntent.client_secret,
            // intent: paymentIntent,
          });
        }

        //process the payment when payment is integrated. For now just resolve the Review
      } else {
        res.send({ status: false, message: "No such review" });
      }
    }
  });
};

export const SendSettlementOffer = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      if (!user) {
        return res.send({ status: false, message: "No such user" });
      }

      let reviewId = req.body.reviewId; // sent by customer
      let settlementAmount = req.body.settlementAmount;

      let review = await db.Review.findByPk(reviewId);
      let sentOffer = await CreateSettlementOfferAndNullifyPast(
        review,
        user,
        settlementAmount
      );
      if (sentOffer && sentOffer.status) {
        let otherUserId = review.customerId;
        let otherUser = await db.User.findByPk(otherUserId);
        if (otherUserId == user.id) {
          //current user is customer
          review.newActivityByCustomer = true;
          review.newActivityByBusiness = false;
          let saved = await review.save();
        } else {
          //current user is Business
          review.newActivityByBusiness = true;
          review.newActivityByCustomer = false;
          let saved = await review.save();
        }
        try {
          await addNotification({
            fromUser: user,
            toUser: otherUser,
            type: NotificationType.SettlementOfferSent,
            productId: review.id, // Optional
          });
        } catch (error) {
          console.log("Error sending not sendmessage chat.controller", error);
        }

        return res.send({ status: true, message: "Sent Settlement Offer" });
      } else {
        return res.send({ status: false, message: "No such review" });
      }
    }
  });
};

export async function CreateSettlementOfferAndNullifyPast(
  review,
  user,
  settlementAmount
) {
  if (review) {
    //set past offers null. only one offer can be active at a time.
    let updated = await db.SettlementOffer.update(
      { status: SettlementOfferTypes.RequestedChange },
      {
        where: {
          reviewId: review.id,
        },
      }
    );

    let created = await db.SettlementOffer.create({
      amount: settlementAmount,
      userId: user.id,
      reviewId: review.id,
    });
    if (created) {
      //send push to customer
      return { status: true, message: "Sent Settlement Offer", offer: created };
    } else {
      return { status: false, message: "Send Settlement Offer Failed" };
    }
  } else {
    return {
      status: false,
      message: "Send Settlement Offer Failed. No such review",
    };
  }
}
