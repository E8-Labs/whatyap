import db from "../models/index.js";
import { SettlementOfferTypes } from "../models/review/settlementoffertypes.js";
import UserProfileLiteResource from "./userprofileliteresource.js";

const Op = db.Sequelize.Op;

const ReviewResource = async (user, currentUser = null) => {
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

async function getUserData(review, currentUser = null) {
  let business = await db.User.findByPk(review.userId);
  // console.log("Reviewer", review.userId);
  let businessRes = await UserProfileLiteResource(business);

  let customer = await db.User.findByPk(review.customerId);
  // console.log("Viewed", customer);
  let customerRes = await UserProfileLiteResource(customer);

  let settlementOffer = await db.SettlementOffer.findOne({
    where: {
      reviewId: review.id,
      status: SettlementOfferTypes.Active,
    },
  });
  //if active then fine otherwise look for requestedChange
  if (!settlementOffer) {
    settlementOffer = await db.SettlementOffer.findOne({
      where: {
        reviewId: review.id,
        status: SettlementOfferTypes.RequestedChange,
      },
    });
  }

  const UserFullResource = {
    id: review.id,
    service: review.service,
    amountOfTransaction: review.amountOfTransaction,
    dateOfTransaction: review.dateOfTransaction,
    mediaUrl: review.mediaUrl,
    thumbUrl: review.thumbUrl,
    yapScore: review.yapScore,
    settlementOffer: review.settlementOffer,
    notesAboutCustomer: review.notesAboutCustomer,
    business: businessRes,
    customer: customerRes,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
    settlementOfferObject: settlementOffer,
    reviewStatus: review.reviewStatus,
    newActivityByCustomer: review.newActivityByCustomer,
    newActivityByBusiness: review.newActivityByBusiness,
  };

  return UserFullResource;
}

export default ReviewResource;
