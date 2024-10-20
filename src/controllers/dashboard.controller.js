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
import User from "../models/auth/user.model.js";
import UserProfileViewResource from "../resources/profileviewresource.js";
import ReviewResource from "../resources/reviewresource.js";
import { CreateSettlementOfferAndNullifyPast } from "./review.controller.js";

export const GetBusinessDashboardData = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);

      if (!user) {
        return res.send({ status: false, data: null, message: "No such user" });
      }

      // Fetch the recently viewed profiles
      let recentlyViewed = await db.ProfileView.findAll({
        where: { userId: user.id },
        include: [{ model: db.User, as: "ViewedUser" }],
        limit: 10,
        order: [["viewedAt", "DESC"]],
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
      }));
      let recentlyViewedData = await UserProfileLiteResource(recentUsers);

      // Fetch customers within 50 miles radius
      let customersNearby = await db.User.findAll({
        where: {
          role: "customer",
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

      const distance = 90; // distance in degrees, or use km-based distance

      let customersNearby = await db.User.findAll({
        where: {
          role: "customer",
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

export const SearchUsers = async (req, res) => {
  const { searchQuery, searchType, offset = 0 } = req.query;

  // Verify JWT Token
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (error) {
      return res.status(403).json({ status: false, message: "Invalid Token" });
    }

    if (authData) {
      const userId = authData.user.id;

      if (!searchQuery || !searchType) {
        return res.status(400).json({
          status: false,
          message: "Missing search query or search type",
        });
      }

      let whereClause = {};

      // Search based on the search type
      if (searchType === "name") {
        whereClause = {
          name: {
            [db.Sequelize.Op.like]: `%${searchQuery}%`,
          },
        };
      } else if (searchType === "driver_license") {
        whereClause = {
          driver_license_id: searchQuery,
        };
      } else {
        return res
          .status(400)
          .json({ status: false, message: "Invalid search type" });
      }

      let role = req.query.role || null;
      if (role) {
        whereClause = { ...whereClause, role: role };
      }

      try {
        // Log the search in SearchHistory
        await db.SearchHistory.create({
          userId: userId,
          searchQuery: searchQuery,
          searchType: searchType,
        });

        // Fetch the search results
        const users = await db.User.findAll({
          where: whereClause,
          limit: 10,
          offset: parseInt(offset, 10),
        });

        // Prepare the response data
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
        }));
        let resource = await UserProfileLiteResource(responseData);

        return res
          .status(200)
          .json({ status: true, data: resource, message: "Search results" });
      } catch (err) {
        return res.status(500).json({
          status: false,
          message: "Error fetching search results",
          error: err.message,
        });
      }
    }
  });
};

//When Business adds a customer
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
      const driver_license_id = req.body.driver_license_id || "";

      if (req.body.driver_license_id) {
        let user = await db.User.findOne({
          where: {
            driver_license_id: driver_license_id,
          },
        });
        if (user) {
          return res.send({
            status: false,
            message: "Customer already present",
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
      });

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
      let user = await db.User.findByPk(authData.user.id);
      if (!user) {
        return res.send({ status: false, message: "No such user" });
      }

      //Add the review here
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
      let mediaUrl = "",
        thumbUrl = "";
      if (req.files && req.files.media) {
        let file = req.files.media[0];
        const mediaBuffer = file.buffer;
        const mediaType = file.mimetype;
        const mediaExt = path.extname(file.originalname);
        const mediaFilename = `${Date.now()}${mediaExt}`;
        console.log("There is a file uploaded");

        mediaUrl = await uploadMedia(
          `review_${mediaFilename}`,
          mediaBuffer,
          "image/jpeg",
          "review_images"
        );

        thumbUrl = await createThumbnailAndUpload(
          mediaBuffer,
          mediaFilename,
          "review_images"
        );
      }

      let created = await db.Review.create({
        service: service,
        amountOfTransaction: amountOfTransaction,
        dateOfTransaction: dateOfTransaction,
        yapScore: yapScore,
        settlementOffer: settlementOffer,
        notesAboutCustomer: notesAboutCustomer,
        mediaUrl: mediaUrl,
        thumbUrl: thumbUrl,
        userId: user.id,
        customerId: customerId,
        settlementAmount: settlementAmount,
      });

      if (created) {
        let sentOffer = null;
        if (settlementOffer == true) {
          sentOffer = await CreateSettlementOfferAndNullifyPast(created);
          // if (sentOffer && sentOffer.status) {
          //   return res.send({ status: true, message: "Sent Settlement Offer" });
          // } else {
          //   return res.send({ status: false, message: "No such review" });
          // }
        }
        let reviewRes = await ReviewResource(created);
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
