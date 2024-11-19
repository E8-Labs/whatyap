import db from "../models/index.js";
import { SettlementOfferTypes } from "../models/review/settlementoffertypes.js";
import UserProfileLiteResource from "./userprofileliteresource.js";
import ReviewResource from "./reviewresource.js";
import { NotificationType } from "../models/notifications/notificationtypes.js";

const Op = db.Sequelize.Op;

const NotificationResource = async (user, currentUser = null) => {
  console.log("Getting Rev Res for ", user);
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

async function getUserData(not, currentUser = null) {
  let review = null,
    message = null,
    chat = null,
    user = null;
  if (not.type == NotificationType.NewUser) {
    user = await db.User.findByPk(not.productId);
  }
  if (
    not.type == NotificationType.ReplyReview ||
    not.type == NotificationType.Disagreement ||
    not.type == NotificationType.SettlementAccepted ||
    not.type == NotificationType.SettlementOfferSent ||
    not.type == NotificationType.SettlementAmountPaid ||
    not.type == NotificationType.NewReviw ||
    not.type == NotificationType.Disagreement
  ) {
    review = await db.Review.findByPk(not.productId);
  }
  if (not.type == NotificationType.TypeNewMessage) {
    message = await db.Message.findByPk(not.productId);
    if (message) {
      chat = await db.Chat.findByPk(message.chatId);
    }
  }

  //   console.log("From user ", not.fromUser);
  let from = await db.User.findByPk(not.fromUser.id);
  let to = await db.User.findByPk(not.toUser);

  if (from) {
    from = await UserProfileLiteResource(from);
  }
  if (to) {
    to = await UserProfileLiteResource(to);
  }

  const NotificationResource = {
    ...not,
    message,
    chat,
    review,
    // user,
    fromUser: from,
    toUser: to,
  };

  return NotificationResource;
}

export default NotificationResource;
