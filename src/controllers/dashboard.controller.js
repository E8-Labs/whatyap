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
import UserProfileLiteResource from "../resources/userprofilefullresource.js";
import {
  createThumbnailAndUpload,
  ensureDirExists,
  uploadMedia,
} from "../utils/generateThumbnail.js";
import User, { AccountStatus, UserRole } from "../models/auth/user.model.js";
import UserProfileViewResource from "../resources/profileviewresource.js";
import ReviewResource from "../resources/reviewresource.js";
import { CreateSettlementOfferAndNullifyPast } from "./review.controller.js";

import { NotificationType } from "../models/notifications/notificationtypes.js";
import { addNotification } from "./notification.controller.js";
import { SearchHistory } from "./user.controller.js";
import { where } from "sequelize";
import { SendEmail } from "../services/MailService.js";
import { generateWhatYapReviewEmail } from "../../Emails/NewReviewEmail.js";

export const GetBusinessDashboardData = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);

      if (!user) {
        return res.send({ status: false, data: null, message: "No such user" });
      }

      // Fetch the recently viewed profiles
      // let recentlyViewed = await db.ProfileView.findAll({
      //   where: { userId: user.id },
      //   include: [{ model: db.User, as: "ViewedUser" }],
      //   limit: 10,
      //   order: [["viewedAt", "DESC"]],
      // });

      let recentlyViewed = await db.ProfileView.findAll({
        where: {
          userId: user.id,
          viewedAt: db.sequelize.literal(`viewedAt = (
            SELECT MAX(viewedAt)
            FROM ProfileViews AS pv
            WHERE pv.userId = ProfileView.userId 
            AND pv.viewedUserId = ProfileView.viewedUserId
          )`),
        },
        include: [{ model: db.User, as: "ViewedUser" }],
        order: [["viewedAt", "DESC"]],
        limit: 10,
      });

      // Convert recently viewed profiles to the required format
      let recentUsers = recentlyViewed.map((view) => ({
        id: view.ViewedUser.id,
        name: view.ViewedUser.name,
        username: view.ViewedUser.username,
        profile_image: view.ViewedUser.profile_image,
        full_profile_image: view.ViewedUser.full_profile_image,
        city: view.ViewedUser.city,
        state: view.ViewedUser.state,
        phone: view.ViewedUser.phone,
        email: view.ViewedUser.email,
        role: view.ViewedUser.role,
      }));
      let recentlyViewedData = await UserProfileLiteResource(recentUsers);

      // Fetch customers within 50 miles radius
      let roleToFind = "customer";
      if (user.role == "customer") {
        roleToFind = "business";
      }
      let customersNearby = await db.User.findAll({
        where: {
          role: roleToFind,
          // lat: {
          //   [db.Sequelize.Op.between]: [user.lat - 0.7, user.lat + 0.7],
          // },
          // lon: {
          //   [db.Sequelize.Op.between]: [user.lon - 0.7, user.lon + 0.7],
          // },
          id: {
            [db.Sequelize.Op.ne]: user.id, // Exclude the user himself
          },
        },
      });

      // Convert customers nearby to the required format
      let customersNearbyData = await UserProfileLiteResource(customersNearby);
      // customersNearby.map(customer => ({
      //     id: customer.id,
      //     name: customer.name,
      //     username: customer.username,
      //     profile_image: customer.profile_image,
      //     distance: calculateDistance(user.lat, user.lon, customer.lat, customer.lon)
      // }));

      // Send response
      res.send({
        status: true,
        data: {
          customers_nearby: customersNearbyData,
          recently_viewed: recentlyViewedData,
        },
        message: "User profile details",
      });
    }
  });
};

export const CustomersNearMe = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      if (!user) {
        return res.send({ status: false, data: null, message: "No such user" });
      }
      const offset = parseInt(req.query.offset) || 0;
      let role = req.query.role;

      if (role) {
      } else {
        if (user.role == "business") {
          role = "customer";
        } else {
          role = "business";
        }
      }

      const distance = 90; // distance in degrees, or use km-based distance

      let customersNearby = await db.User.findAll({
        where: {
          role: role, //"customer",
          // lat: {
          //   [db.Sequelize.Op.between]: [
          //     user.lat - distance,
          //     user.lat + distance,
          //   ],
          // },
          // lon: {
          //   [db.Sequelize.Op.between]: [
          //     user.lon - distance,
          //     user.lon + distance,
          //   ],
          // },
          id: {
            [db.Sequelize.Op.ne]: user.id, // Exclude the user himself
          },
        },
        offset: offset, // Ensure offset is a number, not a string
        limit: 20, // Ensure limit is a number, not a string
        order: [["createdAt", "DESC"]],
      });

      let customersNearbyData = await UserProfileLiteResource(customersNearby);
      return res.send({
        status: true,
        data: customersNearbyData,
        message: "customers near",
      });
    }
  });

  // Convert customers nearby to the required format
};

export const AddProfileView = async (req, res) => {
  const { viewedUserId } = req.body; // Expecting viewedUserId in the request body

  // Verify JWT Token
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (error) {
      return res.status(403).json({ status: false, message: "Invalid Token" });
    }

    if (authData) {
      const userId = authData.user.id;
      let user = await db.User.findByPk(userId);
      // Check if viewedUserId is valid
      const viewedUser = await db.User.findByPk(viewedUserId);
      if (!viewedUser) {
        return res
          .status(404)
          .json({ status: false, message: "Viewed user not found" });
      }

      // Create an entry in ProfileView table
      try {
        let view = await db.ProfileView.create({
          userId: userId, // Viewer User ID
          viewedUserId: viewedUserId, // Viewed User ID
          viewedAt: new Date(), // Current date and time
        });

        let viewRes = await UserProfileViewResource(view);

        let otherUserId = viewedUserId;
        let otherUser = await db.User.findByPk(otherUserId);

        try {
          await addNotification({
            fromUser: user,
            toUser: otherUser,
            type: NotificationType.ProfileView,
            productId: view.id, // Optional
          });
        } catch (error) {
          console.log("Error sending not sendmessage chat.controller", error);
        }
        return res.status(200).json({
          status: true,
          message: "Profile view recorded successfully",
          data: viewRes,
        });
      } catch (err) {
        console.log(err);
        return res.status(500).json({
          status: false,
          message: "Error recording profile view",
          error: err.message,
        });
      }
    }
  });
};

// export const SearchUsers = async (req, res) => {
//   const { searchQuery, searchType, offset = 0 } = req.query;

//   // Verify JWT Token
//   JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
//     if (error) {
//       return res.status(403).json({ status: false, message: "Invalid Token" });
//     }

//     if (authData) {
//       const userId = authData.user.id;

//       if (!searchQuery || !searchType) {
//         return res.status(400).json({
//           status: false,
//           message: "Missing search query or search type",
//         });
//       }

//       let whereClause = {};

//       // Search based on the search type
//       if (searchType === "name") {
//         whereClause = {
//           name: {
//             [db.Sequelize.Op.like]: `%${searchQuery}%`,
//           },
//         };
//       } else if (searchType === "driver_license") {
//         whereClause = {
//           driver_license_id: searchQuery,
//         };
//       } else {
//         return res
//           .status(400)
//           .json({ status: false, message: "Invalid search type" });
//       }

//       let role = req.query.role || null;
//       if (role) {
//         whereClause = { ...whereClause, role: role };
//       }

//       try {
//         // Log the search in SearchHistory
//         await db.SearchHistory.create({
//           userId: userId,
//           searchQuery: searchQuery,
//           searchType: searchType,
//         });

//         // Fetch the search results
//         const users = await db.User.findAll({
//           where: whereClause,
//           limit: 10,
//           offset: parseInt(offset, 10),
//         });

//         // Prepare the response data
//         const responseData = users.map((user) => ({
//           id: user.id,
//           name: user.name,
//           username: user.username,
//           profile_image: user.profile_image,
//           driver_license_id: user.driver_license_id,
//           full_profile_image: user.full_profile_image,
//           city: user.city,
//           state: user.state,
//           phone: user.phone,
//           email: user.email,
//           role: user.role,
//         }));
//         let resource = await UserProfileLiteResource(responseData);

//         return res
//           .status(200)
//           .json({ status: true, data: resource, message: "Search results" });
//       } catch (err) {
//         return res.status(500).json({
//           status: false,
//           message: "Error fetching search results",
//           error: err.message,
//         });
//       }
//     }
//   });
// };

//When Business adds a customer

// export const SearchUsers = async (req, res) => {
//   let {
//     searchQuery,
//     searchType,
//     offset = 0,
//     city,
//     state,
//     minScore,
//     maxScore,
//   } = req.query;

//   // Verify JWT Token
//   JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
//     if (error) {
//       return res.status(403).json({ status: false, message: "Invalid Token" });
//     }

//     if (authData) {
//       const userId = authData.user.id;

//       if (!searchType) {
//         // searchType = "name";
//         // return res.status(400).json({
//         //   status: false,
//         //   message: "Missing search query or search type",
//         // });
//       }

//       let whereClause = {};
//       if (searchQuery) {
//         whereClause = {
//           [db.Sequelize.Op.or]: [
//             {
//               name: {
//                 [db.Sequelize.Op.like]: `%${searchQuery}%`,
//               },
//             },
//             {
//               driver_license_id: {
//                 [db.Sequelize.Op.like]: `%${searchQuery}%`,
//               },
//             },
//           ],
//         };
//       }

//       // Search based on the search type
//       // if (searchType === "name") {
//       //   whereClause = {
//       //     name: {
//       //       [db.Sequelize.Op.like]: `%${searchQuery}%`,
//       //     },
//       //   };
//       // } else if (searchType === "driver_license") {
//       //   whereClause = {
//       //     driver_license_id: searchQuery,
//       //   };
//       // } else {
//       //   // return res
//       //   //   .status(400)
//       //   //   .json({ status: false, message: "Invalid search type" });
//       // }

//       // Filter by role if provided
//       let role = req.query.role || null;
//       if (role) {
//         whereClause = { ...whereClause, role: role };
//       }

//       // Filter by city and state if provided
//       if (city) {
//         whereClause = { ...whereClause, city: city };
//       }
//       if (state) {
//         whereClause = { ...whereClause, state: state };
//       }
//       if (fromDate && toDate) {
//         whereClause.createdAt = {
//           [db.Sequelize.Op.between]: [new Date(fromDate), new Date(toDate)],
//         };
//       }

//       //Fetch only active accounts
//       whereClause = { ...whereClause, accountStatus: AccountStatus.Active };
//       try {
//         // Log the search in SearchHistory
//         if (searchQuery) {
//           let alreadyAdded = await db.SearchHistory.findOne({
//             where: {
//               searchQuery: searchQuery,
//             },
//           });
//           if (!alreadyAdded) {
//             await db.SearchHistory.create({
//               userId: userId,
//               searchQuery: searchQuery,
//               searchType: "",
//             });
//           } else {
//             console.log("Already added");
//           }
//         }

//         // Fetch the search results, including filter for review score range if provided
//         const users = await db.User.findAll({
//           where: whereClause,
//           limit: 10,
//           offset: parseInt(offset, 10),
//           include: [
//             {
//               model: db.Review,
//               required: false,
//               where:
//                 minScore && maxScore
//                   ? {
//                       yapScore: {
//                         [db.Sequelize.Op.between]: [
//                           parseFloat(minScore),
//                           parseFloat(maxScore),
//                         ],
//                       },
//                     }
//                   : null,
//             },
//           ],
//         });

//         // Prepare the response data, including only users that match filters or have no reviews
//         const responseData = users.map((user) => ({
//           id: user.id,
//           name: user.name,
//           username: user.username,
//           profile_image: user.profile_image,
//           driver_license_id: user.driver_license_id,
//           full_profile_image: user.full_profile_image,
//           city: user.city,
//           state: user.state,
//           phone: user.phone,
//           email: user.email,
//           role: user.role,
//         }));
//         let resource = await UserProfileLiteResource(responseData);

//         return res
//           .status(200)
//           .json({ status: true, data: resource, message: "Search results" });
//       } catch (err) {
//         console.log("Error ", error);
//         return res.status(200).json({
//           status: false,
//           message: "Error fetching search results",
//           error: err.message,
//         });
//       }
//     }
//   });
// };

export const SearchUsers = async (req, res) => {
  let {
    searchQuery,
    offset = 0,
    city,
    state,
    minYapScore,
    maxYapScore,
    minTransactionAmount,
    maxTransactionAmount,
    minReviewCount,
    maxReviewCount,
    role,
  } = req.query;

  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (error) {
      return res.status(403).json({ status: false, message: "Invalid Token" });
    }

    if (authData) {
      const userId = authData.user.id;
      let user = await db.User.findByPk(userId);

      let whereClause = "`accountStatus` = 'active'";
      whereClause += ` AND Users.id not in (${userId})`;
      if (searchQuery) {
        whereClause += ` AND (\`name\` LIKE '%${searchQuery}%' OR \`driver_license_id\` LIKE '%${searchQuery}%')`;
      }
      if (role) {
        if (user.role == "customer") {
          whereClause += ` AND \`role\` = '${role}'`;
        }
      } else {
        if (user.role == "customer") {
          role = "business";
          whereClause += ` AND \`role\` = '${role}'`;
        } else {
          // role = "customer";
        }
      }
      if (city) whereClause += ` AND \`city\` = '${city}'`;
      if (state) whereClause += ` AND \`state\` = '${state}'`;
      if (req.query.fromDate && req.query.toDate) {
        whereClause += ` AND \`createdAt\` BETWEEN '${new Date(
          req.query.fromDate
        ).toISOString()}' AND '${new Date(req.query.toDate).toISOString()}'`;
      }

      if (req.query.industry) {
        const str = req.query.industry;
        const indArray = str.split(",").map((item) => `'${item.trim()}'`); // Add quotes
        if (indArray.length > 0) {
          whereClause += ` AND \`business_industry\` IN (${indArray.join(
            ","
          )})`;
        }
      }

      let havingClause = "";
      if (minReviewCount) {
        havingClause += `HAVING COUNT(Reviews.id) >= ${parseInt(
          minReviewCount,
          10
        )}`;
      }
      if (maxReviewCount) {
        if (havingClause) {
          havingClause += ` AND COUNT(Reviews.id) <= ${parseInt(
            maxReviewCount,
            10
          )}`;
        } else {
          havingClause = `HAVING COUNT(Reviews.id) <= ${parseInt(
            maxReviewCount,
            10
          )}`;
        }
      }

      //if it's the business searching then we show transaction range
      if (user.role == UserRole.Business) {
        havingClause = "";
        if (minTransactionAmount) {
          havingClause += `HAVING SUM(Reviews.amountOfTransaction) >= ${parseFloat(
            minTransactionAmount
          )}`;
        }

        if (maxTransactionAmount) {
          if (havingClause) {
            havingClause += ` AND SUM(Reviews.amountOfTransaction) <= ${parseFloat(
              maxTransactionAmount
            )}`;
          } else {
            havingClause = `HAVING SUM(Reviews.amountOfTransaction) <= ${parseFloat(
              maxTransactionAmount
            )}`;
          }
        }
      }

      try {
        let query = `
          SELECT 
            Users.*,
            COUNT(Reviews.id) AS reviewCount
          FROM 
            Users 
          LEFT JOIN 
            Reviews ON  Users.id = Reviews.userId
          WHERE 
            ${whereClause}
          GROUP BY 
            Users.id
          
          ${havingClause}
          ORDER BY createdAt DESC
          LIMIT 10 OFFSET ${parseInt(offset, 10)}
          
          `;
        console.log("Query is ", query);
        const users = await db.sequelize.query(query, {
          type: db.sequelize.QueryTypes.SELECT,
        });

        // Map response data
        const responseData = users.map((user) => ({
          id: user.id,
          name: user.name,
          username: user.username,
          profile_image: user.profile_image,
          driver_license_id: user.driver_license_id,
          full_profile_image: user.full_profile_image,
          city: user.city,
          state: user.state,
          phone: user.phone,
          email: user.email,
          role: user.role,
          reviewCount: user.reviewCount,
        }));

        console.log("Users found in search. Sending to Profile Lite Resource");
        let usersFound = await UserProfileLiteResource(users);
        return res.status(200).json({
          status: true,
          data: usersFound,
          message: "Search results",
        });
      } catch (err) {
        console.error("Error fetching search results:", err);
        return res.status(500).json({
          status: false,
          message: "Error fetching search results",
          error: err.message,
        });
      }
    }
  });
};

export const DeleteSearch = async (req, res) => {
  const { searchId } = req.body; // Expecting viewedUserId in the request body

  // Verify JWT Token
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (error) {
      return res.status(403).json({ status: false, message: "Invalid Token" });
    }

    if (authData) {
      const userId = authData.user.id;
      let user = await db.User.findByPk(userId);
      let del = await db.SearchHistory.destroy({
        where: {
          id: searchId,
        },
      });
      res.send({
        status: true,
        data: null,
        message: "Deleted",
      });
      // Check if viewedUserId is valid
    } else {
    }
  });
};

export const AddCustomer = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      console.log("Data", req.body);
      const name = req.body.name;
      const username = req.body.username || "";
      const email = req.body.email || "";
      const phone = req.body.phone || "";
      const business_website = req.body.business_website || "";
      const role = "customer";
      const driver_license_id = req.body.driver_license_id || null;

      if (req.body.driver_license_id && req.body.driver_license_id != "") {
        console.log("User provided dlc", req.body.driver_license_id);
        let user = await db.User.findOne({
          where: {
            driver_license_id: driver_license_id,
          },
        });
        if (user) {
          console.log("User with dlc", user.id);
          return res.send({
            status: false,
            message: "Customer already present ",
            license: req.body.driver_license_id,
            user: user,
          });
        }
      }

      let profile_image = null;
      let thumbnail_image = null;

      let dl_image = "";

      if (req.files && req.files.media) {
        let file = req.files.media[0];

        const mediaBuffer = file.buffer;
        const mediaType = file.mimetype;
        const mediaExt = path.extname(file.originalname);
        const mediaFilename = `${Date.now()}${mediaExt}`;
        console.log("There is a file uploaded");

        profile_image = await uploadMedia(
          `profile_${mediaFilename}`,
          mediaBuffer,
          "image/jpeg",
          "profile_images"
        );

        thumbnail_image = await createThumbnailAndUpload(
          mediaBuffer,
          mediaFilename,
          "profile_images"
        );
      }

      if (req.files && req.files.driver_license) {
        let file = req.files.driver_license[0];

        const mediaBuffer = file.buffer;
        const mediaType = file.mimetype;
        const mediaExt = path.extname(file.originalname);
        const mediaFilename = `${Date.now()}${mediaExt}`;
        console.log("There is a dl image uploaded");

        dl_image = await uploadMedia(
          `dl_${mediaFilename}`,
          mediaBuffer,
          "image/jpeg",
          "profile_images"
        );

        //   thumbnail_image = await createThumbnailAndUpload(mediaBuffer, mediaFilename, "profile_images")
      }

      const createdUser = await db.User.create({
        email: email,
        name: name,
        phone: phone,
        username: username,
        role: role,
        full_profile_image: profile_image,
        profile_image: thumbnail_image,
        business_website: business_website,
        driver_license_id: req.body.driver_license_id,
        driver_license_image: dl_image,
        addedBy: authData.user.id,
        plan_status: "free",
      });

      // let emailTemp = generateWhatYapReviewEmail(name, authData.user.name, "");
      // let sent = await SendEmail(email, "New Customer", emailTemp);
      return res.send({
        status: true,
        message: "Customer added",
        data: createdUser,
      });
    } else {
      return res.send({
        status: false,
        message: "Unauthenticated User",
        data: null,
      });
    }
  });
};

export const AddReview = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id, { raw: true });
      if (!user) {
        return res.send({ status: false, message: "No such user" });
      }

      // Add the review here
      let {
        service,
        amountOfTransaction,
        dateOfTransaction,
        yapScore,
        settlementOffer,
        notesAboutCustomer,
        customerId,
        settlementAmount,
      } = req.body;
      let mediaUrls = [];
      let thumbUrls = [];

      let customer = await db.User.findByPk(customerId, { raw: true });
      if (!customer) {
        return res.send({ status: false, message: "No such customer" });
      }

      if (req.files && req.files.media) {
        for (let file of req.files.media) {
          const mediaBuffer = file.buffer;
          const mediaExt = path.extname(file.originalname);
          const mediaFilename = `${Date.now()}${mediaExt}`;

          console.log("There is a file uploaded");

          // Upload the media file
          const mediaUrl = await uploadMedia(
            `review_${mediaFilename}`,
            mediaBuffer,
            "image/jpeg",
            "review_images"
          );

          // Create the thumbnail for the media file
          const thumbUrl = await createThumbnailAndUpload(
            mediaBuffer,
            mediaFilename,
            "review_images"
          );

          // Save the media and thumbnail URLs
          mediaUrls.push(mediaUrl);
          thumbUrls.push(thumbUrl);
        }
      }

      // Create the review record
      let created = await db.Review.create({
        service: service,
        amountOfTransaction: Number(amountOfTransaction) || 0,
        dateOfTransaction: dateOfTransaction,
        yapScore: Number(yapScore),
        settlementOffer: settlementOffer,
        notesAboutCustomer: notesAboutCustomer,
        userId: user.id,
        customerId: customerId,
        settlementAmount: settlementAmount,
      });

      if (created) {
        let sentOffer = null;
        if (settlementOffer == true || settlementOffer == "true") {
          sentOffer = await CreateSettlementOfferAndNullifyPast(
            created,
            user,
            settlementAmount
          );
        }

        // Save the uploaded images in the ReviewImage table
        for (let i = 0; i < mediaUrls.length; i++) {
          await db.ReviewImage.create({
            media_url: mediaUrls[i],
            thumb_url: thumbUrls[i],
            reviewId: created.id,
          });
        }

        let reviewRes = await ReviewResource(created);

        try {
          let admin = await db.User.findOne({
            where: {
              role: "admin",
            },
          });
          if (admin) {
            await addNotification({
              fromUser: user,
              toUser: admin,
              type: NotificationType.NewReviw,
              productId: created.id, // Optional
            });
          }
          let customer = await db.User.findByPk(customerId);
          await addNotification({
            fromUser: user,
            toUser: customer,
            type: NotificationType.NewReviw,
            productId: created.id, // Optional
          });
          if (Number(yapScore) == 5) {
            await addNotification({
              fromUser: user,
              toUser: customer,
              type: NotificationType.FiveStarReview,
              productId: created.id, // Optional
            });
          }
        } catch (error) {
          console.log("Error sending not Add Review ", error);
        }

        // console.log("Business ", user);
        console.log("Customer:", customer);
        console.log("Type:", typeof customer);
        console.log(
          "Instance of Sequelize Model:",
          customer instanceof db.Sequelize.Model
        ); // should be true
        let customerName = customer.name;
        let businessName = user.name;
        console.log("Has get method:", typeof customer.get); // should be 'function'
        console.log("Name via dataValues:", customer.dataValues?.name);
        console.log("Name via get:", customer.get?.("name"));
        console.log("Name via direct:", customerName);
        console.log("Business Name", businessName);
        console.log("All keys:", Object.keys(customer));
        let emailTemp = generateWhatYapReviewEmail(
          customerName,
          businessName,
          ""
        );

        let sent = await SendEmail(customer.email, "New Review", emailTemp);
        return res.send({
          status: true,
          message: "Review added",
          data: reviewRes,
          settlementOffer: sentOffer,
        });
      }
    } else {
      return res.send({ status: false, message: "Unauthenticated user" });
    }
  });
};

// Helper function to calculate distance between two points using the Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};
