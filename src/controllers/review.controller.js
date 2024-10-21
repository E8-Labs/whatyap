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

export const LoadReviews = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      console.log("Loading reviews for ", authData.user.id);
      let user = await db.User.findByPk(authData.user.id);
      if (!user) {
        return res.send({ status: false, message: "No such user" });
      }
      let offset = Number(req.query.offset || 0) || 0;
      let reviewStatus = req.query.reviewStatus || ReviewTypes.Posted;

      let userId = user.id;
      if (req.query.userId) {
        userId = req.query.userId;
      }
      let condition = {
        reviewStatus: reviewStatus,
      };

      if (reviewStatus == ReviewTypes.Active) {
        condition = {
          [db.Sequelize.Op.or]: [
            { reviewStatus: ReviewTypes.Active },
            { reviewStatus: ReviewTypes.Disputed },
          ],
        };
      } else if (reviewStatus == ReviewTypes.Settlement) {
        // fetch all active which only have
        condition = {
          [db.Sequelize.Op.or]: [
            { reviewStatus: ReviewTypes.Active },
            { reviewStatus: ReviewTypes.Disputed },
          ],
          settlementOffer: true,
        };
      } else {
        //Fetch the past and resolved reviews. We will be running cron job to mark the reviews past if no activity within 48 hours.
        condition = {
          [db.Sequelize.Op.or]: [
            { reviewStatus: ReviewTypes.Past },
            { reviewStatus: ReviewTypes.Resolved },
            { reviewStatus: ReviewTypes.ResolvedByAdmin },
          ],
        };
      }

      if (user.role == "customer") {
        condition = { ...condition, customerId: userId };
      } else {
        condition = { ...condition, userId: userId };
      }
      if (req.query.userId) {
        // if user wants to review of the other business or customer then this api would be called
        condition = {
          ...condition,
          [db.Sequelize.Op.or]: [{ userId: userId }, { customerId: userId }],
        };
      }

      console.log("Condition is ", condition);

      let reviews = await db.Review.findAll({
        where: condition,
        offset: offset,
        limit: 20,
      });

      let reviewRes = [];
      if (reviews) {
        console.log("Reviews found ", reviews.length);
        reviewRes = await ReviewResource(reviews);
      }

      return res.send({
        status: true,
        message: "All reviews",
        data: reviewRes,
      });
    }
  });
};

export const DisputeReview = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      if (!user) {
        return res.send({ status: false, message: "No such user" });
      }

      let reviewId = req.body.reviewId; // sent by customer
      let review = await db.Review.findByPk(reviewId);
      if (review) {
        review.reviewStatus = ReviewTypes.Disputed;
        let saved = await review.save();
        if (saved) {
          let reviewRes = await ReviewResource(review);
          return res.send({
            statu: true,
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
        //process the payment when payment is integrated. For now just resolve the Review
        review.reviewStatus = ReviewTypes.Resolved;
        settlementOffer.status = SettlementOfferTypes.Paid;
        let offerSaved = await settlementOffer.save();
        let saved = await review.save();
        if (saved) {
          let reviewRes = await ReviewResource(review);
          return res.send({
            statu: true,
            message: "Review resolved and settlement offer paid",
            data: reviewRes,
          });
        }
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
      let sentOffer = await CreateSettlementOfferAndNullifyPast(review, user);
      if (sentOffer && sentOffer.status) {
        return res.send({ status: true, message: "Sent Settlement Offer" });
      } else {
        return res.send({ status: false, message: "No such review" });
      }
    }
  });
};

export async function CreateSettlementOfferAndNullifyPast(review, user) {
  if (review) {
    let created = await db.SettlementOffer.create({
      amount: settlementAmount,
      userId: user.id,
      reviewId: review.id,
    });
    if (created) {
      //set past offers null. only one offer can be active at a time.
      let updated = await db.SettlementOffer.update(
        { status: SettlementOfferTypes.RequestedChange },
        {
          where: {
            reviewId: review.id,
          },
        }
      );

      //send push to customer
      return { status: true, message: "Sent Settlement Offer", offer: created };
    } else {
      return { status: false, message: "Send Settlement Offer Failed" };
    }
  }
}
