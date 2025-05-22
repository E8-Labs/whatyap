import { UserRole } from "../models/auth/user.model.js";
import db from "../models/index.js";
import { ReviewTypes } from "../models/review/reviewtypes.js";

export const getTotalYapScore = async function (user) {
  console.log("Yap loading ", user.id);
  const totalYapScore = await db.Review.sum("yapScore", {
    where: {
      customerId: user.id,
      reviewStatus: {
        [db.Sequelize.Op.notIn]: [
          ReviewTypes.Resolved,
          ReviewTypes.DeletedFromPlatform,
          ReviewTypes.HiddenFromPlatform,
          ReviewTypes.ResolvedByAdmin,
        ],
      },
    },
  });
  console.log("Yap ", totalYapScore);
  return totalYapScore || 0; // Return 0 if no reviews are found
};

export function Get3DigitYapScore(numReviews, averageStars) {
  if (numReviews <= 0 || averageStars < 1 || averageStars > 5) {
    return "Invalid input";
  }

  return Math.floor((1000 / 5) * averageStars);

  // Base formula for scoring
  const baseScore = averageStars * 200; // Amplify star value for weighting
  const reviewModifier = Math.min(numReviews, 100) * 5; // Cap review influence to 100 reviews for fairness

  // Calculate the final score
  const finalScore = baseScore + reviewModifier;
  return Math.min(Math.max(Math.floor(finalScore), 100), 999); // Ensure score stays within 3-digit range
}

export const getTotalReviews = async function (user, activeReviews = false) {
  console.log("Reviews loading ", user.id);
  let reviews = await db.Review.count({
    where: {
      customerId: user.id,
      // reviewStatus: {
      //   [db.Sequelize.Op.notIn]: [
      //     ReviewTypes.Resolved,
      //     ReviewTypes.DeletedFromPlatform,
      //     ReviewTypes.HiddenFromPlatform,
      //     ReviewTypes.ResolvedByAdmin,
      //   ],
      // },
    },
  });
  if (activeReviews) {
    reviews = await db.Review.count({
      where: {
        customerId: user.id,
        reviewStatus: {
          [db.Sequelize.Op.notIn]: [
            ReviewTypes.Resolved,
            ReviewTypes.DeletedFromPlatform,
            ReviewTypes.HiddenFromPlatform,
            ReviewTypes.ResolvedByAdmin,
          ],
        },
      },
    });
  }
  if (user.role == UserRole.Business) {
    reviews = await db.Review.count({
      where: {
        userId: user.id,
        // reviewStatus: {
        //   [db.Sequelize.Op.notIn]: [
        //     ReviewTypes.Resolved,
        //     ReviewTypes.DeletedFromPlatform,
        //     ReviewTypes.HiddenFromPlatform,
        //     ReviewTypes.ResolvedByAdmin,
        //   ],
        // },
      },
    });
  }
  console.log("TotalRev ", reviews);
  return reviews || 0;
};

export const getTotalSpent = async function (user) {
  console.log("Spent loading ", user.id);
  let reviews = await db.Review.sum("amountOfTransaction", {
    where: { customerId: user.id },
    // reviewStatus: {
    //   [db.Sequelize.Op.notIn]: [
    //     ReviewTypes.Resolved,
    //     ReviewTypes.DeletedFromPlatform,
    //     ReviewTypes.HiddenFromPlatform,
    //     ReviewTypes.ResolvedByAdmin,
    //   ],
    // },
  });

  return reviews || 0;
};
