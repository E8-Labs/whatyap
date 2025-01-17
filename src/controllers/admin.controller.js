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
import Review from "../models/review/review.model.js";
import ReviewResource from "../resources/reviewresource.js";
import { AccountStatus } from "../models/auth/user.model.js";

export const DeleteAccount = async (req, res) => {
  console.log("Delete Account");
  let userId = req.body.userId;
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    console.log("Jwt verify");
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      if (user && user.role == "admin") {
        let userToDeleted = await db.User.findByPk(userId);
        userToDeleted.accountStatus = AccountStatus.Deleted;
        let saved = await userToDeleted.save();
        return res.status(200).send({
          status: true,
          message: "Account is now deleted from platform.",
        });
      } else {
        return res.status(200).send({
          status: false,
          message: "Only admin can access this resource",
        });
      }
    }
  });
};

export const SuspendAccount = async (req, res) => {
  console.log("Suspend Account");
  let userId = req.body.userId;
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    console.log("Jwt verify");
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      if (user && user.role == "admin") {
        let userToDeleted = await db.User.findByPk(userId);
        userToDeleted.accountStatus = AccountStatus.Suspended;
        let saved = await userToDeleted.save();
        return res.status(200).send({
          status: true,
          message: "Account is now suspended from platform.",
        });
      } else {
        return res.status(200).send({
          status: false,
          message: "Only admin can access this resource",
        });
      }
    }
  });
};

export const ResolveOrReject = async (req, res) => {
  console.log("ResoveOrReject");
  let reviewId = req.body.reviewId;
  let resolve = req.body.resolve || false;
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    console.log("Jwt verify");
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      if (user && user.role == "admin") {
        let review = await db.Review.findByPk(reviewId);
        if (resolve) {
          review.reviewStatus = ReviewTypes.ResolvedByAdmin;
        } else {
          review.reviewStatus = ReviewTypes.ResjectedByAdmin;
        }
        let saved = await review.save();
        return res.status(200).send({
          status: true,
          message: `Review is  + ${resolve ? "resolved" : "rejected"}`,
        });
      } else {
        return res.status(200).send({
          status: false,
          message: "Only admin can access this resource",
        });
      }
    }
  });
};

export const HideFromPlatform = async (req, res) => {
  console.log("Load dashboard");
  let reviewId = req.body.reviewId;
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    console.log("Jwt verify");
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      if (user && user.role == "admin") {
        let review = await db.Review.findByPk(reviewId);
        review.reviewStatus = ReviewTypes.HiddenFromPlatform;
        let saved = await review.save();

        let customer = await db.User.findByPk(review.customerId);
        let business = await db.User.findByPk(review.userId);
        await addNotification({
          fromUser: business,
          toUser: customer,
          type: NotificationType.ReviewRemoved,
          productId: review.id, // Optional
        });
        return res.status(200).send({
          status: true,
          message: "Review is now hidden from platform.",
        });
      } else {
        return res.status(200).send({
          status: false,
          message: "Only admin can access this resource",
        });
      }
    }
  });
};

export const DeleteFromPlatform = async (req, res) => {
  console.log("Load dashboard");
  let reviewId = req.body.reviewId;
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    console.log("Jwt verify");
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      if (user && user.role == "admin") {
        let review = await db.Review.findByPk(reviewId);
        review.reviewStatus = ReviewTypes.DeletedFromPlatform;
        let saved = await review.save();

        let customer = await db.User.findByPk(review.customerId);
        let business = await db.User.findByPk(review.userId);
        await addNotification({
          fromUser: business,
          toUser: customer,
          type: NotificationType.ReviewRemoved,
          productId: review.id, // Optional
        });
        return res.status(200).send({
          status: true,
          message: "Review is now deleted from platform.",
        });
      } else {
        return res.status(200).send({
          status: false,
          message: "Only admin can access this resource",
        });
      }
    }
  });
};

// export const AdminResolutions = async (req, res) => {
//   console.log("Load Resolutions");
//   JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
//     console.log("Jwt verify");
//     if (authData) {
//       let user = await db.User.findByPk(authData.user.id);
//       if (user && user.role === "admin") {
//         // Fetch reviews with reviewStatus disputed or older than 48 hours and check for non-null customerId and userId
//         let reviews = await db.Review.findAll({
//           where: {
//             [db.Sequelize.Op.or]: [
//               { reviewStatus: ReviewTypes.Disputed },
//               { settlementOffer: true },
//               // {
//               //   createdAt: {
//               //     [db.Sequelize.Op.lt]: new Date(
//               //       Date.now() - 48 * 60 * 60 * 1000
//               //     ),
//               //   },
//               // },
//             ],
//           },
//           include: [
//             {
//               model: db.User,
//               as: "User",
//               required: true,
//               where: {
//                 id: db.Sequelize.col("Review.userId"),
//               },
//             },
//             {
//               model: db.User,
//               as: "CustomerUser",
//               required: true,
//               where: {
//                 id: db.Sequelize.col("Review.customerId"),
//               },
//             },
//           ],
//         });

//         return res.status(200).send({
//           status: true,
//           message: "Reviews to be resolved",
//           data: await ReviewResource(reviews),
//         });
//       } else {
//         return res.status(200).send({
//           status: false,
//           message: "Only admin can access this resource",
//         });
//       }
//     }
//   });
// };

export const AdminResolutions = async (req, res) => {
  console.log("Load Resolutions");
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    console.log("Jwt verify");
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      if (user && user.role === "admin") {
        // Extract filters from the request query
        const {
          disputeStatus,
          settlementOffer,
          minAmount,
          maxAmount,
          active,
          resolved,
        } = req.query;

        // Build the where clause dynamically based on filters
        const whereClause = {
          [db.Sequelize.Op.and]: [],
        };

        if (settlementOffer !== undefined) {
          console.log("Found Filter Settlement");
          whereClause[db.Sequelize.Op.and].push({
            settlementOffer: settlementOffer == "true",
          });
        }

        if (minAmount !== undefined || maxAmount !== undefined) {
          console.log("Found Filter amount");
          const amountClause = {};
          if (minAmount !== undefined) {
            amountClause[db.Sequelize.Op.gte] = parseFloat(minAmount);
          }
          if (maxAmount !== undefined) {
            amountClause[db.Sequelize.Op.lte] = parseFloat(maxAmount);
          }
          whereClause[db.Sequelize.Op.and].push({
            amountOfTransaction: amountClause,
          });
        }

        if (active !== undefined) {
          console.log("Found Filter active status", active);
          if (disputeStatus !== undefined) {
            console.log("Found Filter disputeStatus");
            whereClause[db.Sequelize.Op.and].push({
              reviewStatus:
                disputeStatus == "true"
                  ? ReviewTypes.Disputed
                  : { [db.Sequelize.Op.ne]: ReviewTypes.Disputed },
            });
          } else {
            whereClause[db.Sequelize.Op.and].push({
              reviewStatus:
                active == "true"
                  ? {
                      [db.Sequelize.Op.in]: [
                        ReviewTypes.Disputed,
                        ReviewTypes.Active,
                      ],
                    }
                  : {
                      [db.Sequelize.Op.in]: [
                        ReviewTypes.Resolved,
                        ReviewTypes.ResolvedByAdmin,
                      ],
                    },
            });
          }
        }

        // if (resolved !== undefined) {
        //   whereClause[db.Sequelize.Op.and].push({
        //     reviewStatus:
        //       resolved === "true"
        //         ? ReviewTypes.Resolved
        //         : { [db.Sequelize.Op.ne]: ReviewTypes.Resolved },
        //   });
        // }

        console.log("Where Clause ", JSON.stringify(whereClause));
        // Fetch reviews with the dynamically built where clause
        let reviews = await db.Review.findAll({
          where: whereClause,
          include: [
            {
              model: db.User,
              as: "User",
              required: true,
              where: {
                id: db.Sequelize.col("Review.userId"),
              },
            },
            {
              model: db.User,
              as: "CustomerUser",
              required: true,
              where: {
                id: db.Sequelize.col("Review.customerId"),
              },
            },
          ],
        });

        return res.status(200).send({
          status: true,
          message: "Reviews to be resolved",
          data: await ReviewResource(reviews),
          clause: JSON.stringify(whereClause),
        });
      } else {
        return res.status(200).send({
          status: false,
          message: "Only admin can access this resource",
        });
      }
    }
  });
};

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
          return res.status(200).send({
            status: false,
            message: "Only admin can access this resource",
          });
        }

        let totalCustomers = await db.User.count({
          where: { role: "customer" },
        });
        let totalBusiness = await db.User.count({
          where: { role: "business" },
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
