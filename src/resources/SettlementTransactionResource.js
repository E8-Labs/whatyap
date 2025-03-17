import db from "../models/index.js";
import {
  getTotalYapScore,
  getTotalReviews,
  getTotalSpent,
  Get3DigitYapScore,
} from "../utils/user.utility.js";
import ReviewResource from "./reviewresource.js";

const Op = db.Sequelize.Op;

const SettlementTransactionResource = async (user, currentUser = null) => {
  if (!Array.isArray(user)) {
    //////console.log("Not array")
    return await getUserData(user, currentUser);
  } else {
    //////console.log("Is array")
    const data = [];
    for (let i = 0; i < user.length; i++) {
      const p = await getUserData(user[i], currentUser);
      //////console.log("Adding to index " + i)
      data.push(p);
    }

    return data;
  }
};

async function getUserData(user, currentUser = null) {
  if (!user) {
    return null;
  }

  let settlement = await db.SettlementOffer.findByPk(user.settlementOfferId);
  let review = await db.Review.findByPk(settlement.reviewId);
  // }
  console.log("Getting user lite res");
  const UserFullResource = {
    ...user.get(),
    data: null,
    review: await ReviewResource(review),
    settlement,
    description: `Settlement for ${review.service}`,
  };

  return UserFullResource;
}

export default SettlementTransactionResource;
