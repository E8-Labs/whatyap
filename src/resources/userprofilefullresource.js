import db from "../models/index.js";
import {
  getTotalYapScore,
  getTotalReviews,
  getTotalSpent,
  Get3DigitYapScore,
} from "../utils/user.utility.js";
// import AssistantLiteResource from "./assistantliteresource.js";
// import UserSubscriptionResource from "./usersubscription.resource.js";
import { getSubscriptionDetails } from "../services/subscriptionService.js";

const Op = db.Sequelize.Op;

const UserProfileFullResource = async (user, currentUser = null) => {
  // console.log("Users arried in Profile Lite Resource");
  if (!Array.isArray(user)) {
    //////console.log("Not array")
    return await getUserData(user, currentUser);
  } else {
    //////console.log("Is array")
    const data = [];
    for (let i = 0; i < user.length; i++) {
      const p = await getUserData(user[i], currentUser);
      ////////console.log("Adding to index " + i)
      data.push(p);
    }

    return data;
  }
};

async function getUserData(user, currentUser = null) {
  if (!user) {
    return null;
  }
  let media = await db.UserMedia.findAll({
    where: {
      userId: user.id,
    },
  });

  console.log("Type of user is ", typeof user);
  let totalYapScore = 0;
  let reviews = 0;
  let yapScore3Digit = 0;
  // if (user instanceof db.User) {
  //
  totalYapScore = await getTotalYapScore(user);
  reviews = await getTotalReviews(user);

  const reviewsActiveCount = await getTotalReviews(user, true);
  if (reviewsActiveCount != 0) {
    yapScore3Digit = Get3DigitYapScore(
      reviewsActiveCount,
      totalYapScore / reviewsActiveCount
    );
  }
  console.log("-------------------------------");
  console.log("Total Yap", totalYapScore);
  console.log("YapScore3Digit", yapScore3Digit);
  console.log("Reviews ", reviews);
  console.log("-------------------------------");
  // }

  const subscriptionDetails = await getSubscriptionDetails(user);

  let unread = await db.Notification.count({
    where: {
      toUser: user.id,
      isRead: false,
    },
  });
  const UserFullResource = {
    id: user.id,
    name: user.name,
    profile_image: user.profile_image,
    full_profile_image: user.full_profile_image,
    email: user.email,
    phone: user.phone,
    city: user.city,
    state: user.state,
    role: user.role,
    username: user.username, // added this as it's part of your Sequelize model
    driver_license_id: user.driver_license_id, // added missing fields from Sequelize model
    driver_license_image: user.driver_license_image,
    fcm_token: user.fcm_token,
    business_industry: user.business_industry,
    business_website: user.business_website,
    business_address: user.business_address,
    about_business: user.about_business,
    business_employees: user.business_employees,
    credits_available: user.credits_available,
    lat: user.lat,
    lon: user.lon,
    addedBy: user.addedBy,
    media: media,
    totalYapScore: totalYapScore,
    totalReviews: reviews,
    subscription: subscriptionDetails,
    createdAt: user.createdAt,
    totalSpent: await getTotalSpent(user),
    yapScore3Digit: yapScore3Digit,
    reviewsActiveCount: reviewsActiveCount,
    average: totalYapScore / reviewsActiveCount,
    unread: unread,
  };

  return UserFullResource;
}

// const calculateTotalEarned = async (modelId) => {
//   try {
//     let amountToChargePerMin = 10; // Dollars
//     let ai = await db.UserAi.findOne({
//       where: {
//         userId: modelId,
//       },
//     });
//     if (ai) {
//       //console.log("An AI Found for user ", ai);
//       amountToChargePerMin = ai.price;
//     } else {
//       amountToChargePerMin = 10; // by default 10
//     }
//     // Find all calls to the given creator (modelId)
//     const calls = await db.CallModel.findAll({
//       where: {
//         modelId: modelId,
//       },
//       attributes: [
//         "userId",
//         [db.Sequelize.fn("SUM", db.Sequelize.col("duration")), "totalDuration"],
//       ],
//       group: ["userId"],
//     });

//     let totalEarned = 0;

//     calls.forEach((call) => {
//       const totalDurationInSeconds = parseInt(
//         call.getDataValue("totalDuration"),
//         10
//       );
//       const totalDurationInMinutes = totalDurationInSeconds / 60;
//       console.log(
//         `Duration for ${totalDurationInSeconds} sec in min ${totalDurationInMinutes}`
//       );

//       // Subtract 5 minutes free per user
//       const billableMinutes =
//         totalDurationInMinutes > 5 ? totalDurationInMinutes - 5 : 0;

//       // Charge $1 per minute for billable minutes
//       const earnedForUser = billableMinutes * amountToChargePerMin; // $1 per minute
//       console.log(`TotalEarned ${call.userId}`, earnedForUser);
//       totalEarned += earnedForUser;
//     });

//     return totalEarned;
//   } catch (error) {
//     console.error("Error calculating total earned: ", error);
//     return 0;
//   }
// };

export default UserProfileFullResource;
