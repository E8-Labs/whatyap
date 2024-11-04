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
import { ReviewTypes } from "../models/review/reviewtypes.js";

export async function LoadDashboardData(req, res) {
  console.log("Load dashboard");
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    console.log("Jwt verify");
    if (authData) {
      console.log("Auth data yes");
      try {
        const user = await db.User.findByPk(authData.user.id);
        if (!user) {
          return res
            .status(200)
            .send({ status: false, message: "No such user" });
        }
        if (user.role != "admin") {
          return res.status(200).send({
            status: false,
            message: "Only admin can access this resource",
          });
        }

        let customers = await db.User.count({
          where: { role: "customer" },
        });
        let businesses = await db.User.count({
          where: { role: "business" },
        });
        let reviews = await db.Review.count();

        let reviewsActive = await db.Review.count({
          where: {
            [db.Sequelize.Op.or]: [
              { reviewStatus: ReviewTypes.Active },
              { reviewStatus: ReviewTypes.Disputed },
            ],
          },
        });

        let recentBusinesses = await db.User.findAll({
          limit: 10,
          order: [["createdAt", "DESC"]],
        });

        return res.send({
          status: true,
          message: "Dashboard data",
          data: {
            customers,
            businesses,
            totalReviews: reviews,
            activeReviews: reviewsActive,
            recentBusinesses: recentBusinesses,
          },
        });
      } catch (error) {
        console.log(error);
        res.send({ status: false, message: error.message, data: null });
      }
    } else {
      res.send({ status: false, message: "Unauthenticated user" });
    }
  });
}

export async function AdminAnalytics(req, res) {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      try {
        const user = await db.User.findByPk(authData.user.id);
        if (!user) {
          return res
            .status(200)
            .send({ status: false, message: "No such user" });
        }
        if (user.role != "admin") {
          return res
            .status(200)
            .send({
              status: false,
              message: "Only admin can access this resource",
            });
        }

        let totalCustomers = await db.User.count({
          where: { role: "customer" },
        });
        let recentBusinesses = await db.User.findAll({
          where: {
            role: "business",
          },
          limit: 10,
          order: [["createdAt", "DESC"]],
        });

        let recentCustomers = await db.User.findAll({
          where: {
            role: "customer",
          },
          limit: 10,
          order: [["createdAt", "DESC"]],
        });

        return res.send({
          status: true,
          message: "Dashboard data",
          data: {
            mauCustomer: await getMonthlyUserCounts(),
            wauCustomer: await getWeeklyUserCounts(),
            dauCustomer: await getDailyUserCounts(),
            mauBusiness: await getMonthlyUserCounts("business"),
            wauBusiness: await getWeeklyUserCounts("business"),
            dauBusiness: await getDailyUserCounts("business"),

            mauReviews: await getMonthlyReviewCounts(),
            wauReviews: await getWeeklyReviewCounts(),
            dauReviews: await getDailyReviewCounts(),

            totalCustomers: totalCustomers,
            recentBusinesses: recentBusinesses,
            recentCustomers: recentCustomers,
          },
        });
      } catch (error) {}
    }
  });
}

const getDailyReviewCounts = async () => {
  const dailyUsers = await db.Review.findAll({
    attributes: [
      [db.Sequelize.fn("DATE", db.Sequelize.col("createdAt")), "date"],
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
    ],
    where: {
      createdAt: {
        [db.Sequelize.Op.gte]: db.Sequelize.literal("NOW() - INTERVAL 30 DAY"),
      },
    },
    group: ["date"],
    order: [[db.Sequelize.literal("date"), "ASC"]],
  });

  return dailyUsers;
};

// Fetch weekly user counts for the past 12 weeks
const getWeeklyReviewCounts = async () => {
  const weeklyUsers = await db.Review.findAll({
    attributes: [
      [db.Sequelize.fn("YEAR", db.Sequelize.col("createdAt")), "year"],
      [db.Sequelize.fn("WEEK", db.Sequelize.col("createdAt")), "week"],
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
    ],
    where: {
      createdAt: {
        [db.Sequelize.Op.gte]: db.Sequelize.literal("NOW() - INTERVAL 12 WEEK"),
      },
    },
    group: ["year", "week"],
    order: [
      [db.Sequelize.literal("year"), "ASC"],
      [db.Sequelize.literal("week"), "ASC"],
    ],
  });

  return weeklyUsers;
};

// Fetch monthly user counts for the past 12 months
const getMonthlyReviewCounts = async () => {
  const monthlyUsers = await db.Review.findAll({
    attributes: [
      [db.Sequelize.fn("YEAR", db.Sequelize.col("createdAt")), "year"],
      [db.Sequelize.fn("MONTH", db.Sequelize.col("createdAt")), "month"],
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
    ],
    where: {
      createdAt: {
        [db.Sequelize.Op.gte]: db.Sequelize.literal("NOW() - INTERVAL 1 YEAR"),
      },
    },
    group: ["year", "month"],
    order: [
      [db.Sequelize.literal("year"), "ASC"],
      [db.Sequelize.literal("month"), "ASC"],
    ],
  });

  return monthlyUsers;
};

const getDailyUserCounts = async (role = "customer") => {
  const dailyUsers = await db.User.findAll({
    attributes: [
      [db.Sequelize.fn("DATE", db.Sequelize.col("createdAt")), "date"],
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
    ],
    where: {
      createdAt: {
        [db.Sequelize.Op.gte]: db.Sequelize.literal("NOW() - INTERVAL 30 DAY"),
      },
      role: role,
    },
    group: ["date"],
    order: [[db.Sequelize.literal("date"), "ASC"]],
  });

  return dailyUsers;
};

// Fetch weekly user counts for the past 12 weeks
const getWeeklyUserCounts = async (role = "customer") => {
  const weeklyUsers = await db.User.findAll({
    attributes: [
      [db.Sequelize.fn("YEAR", db.Sequelize.col("createdAt")), "year"],
      [db.Sequelize.fn("WEEK", db.Sequelize.col("createdAt")), "week"],
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
    ],
    where: {
      createdAt: {
        [db.Sequelize.Op.gte]: db.Sequelize.literal("NOW() - INTERVAL 12 WEEK"),
      },
      role: role,
    },
    group: ["year", "week"],
    order: [
      [db.Sequelize.literal("year"), "ASC"],
      [db.Sequelize.literal("week"), "ASC"],
    ],
  });

  return weeklyUsers;
};

// Fetch monthly user counts for the past 12 months
const getMonthlyUserCounts = async (role = "customer") => {
  const monthlyUsers = await db.User.findAll({
    attributes: [
      [db.Sequelize.fn("YEAR", db.Sequelize.col("createdAt")), "year"],
      [db.Sequelize.fn("MONTH", db.Sequelize.col("createdAt")), "month"],
      [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "count"],
    ],
    where: {
      createdAt: {
        [db.Sequelize.Op.gte]: db.Sequelize.literal("NOW() - INTERVAL 1 YEAR"),
      },
      role: role,
    },
    group: ["year", "month"],
    order: [
      [db.Sequelize.literal("year"), "ASC"],
      [db.Sequelize.literal("month"), "ASC"],
    ],
  });

  return monthlyUsers;
};