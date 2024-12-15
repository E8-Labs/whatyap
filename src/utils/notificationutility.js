import db from "../models/index.js";
import Expo from "expo-server-sdk";
// import { sendNotWithUser } from "../controllers/push.controller.js";
import { NotificationType } from "../models/notifications/notificationtypes.js";

function getTitleForNotification(type) {
  if (type === NotificationType.TypeNewUser) {
    return "New user";
  }
  if (type === NotificationType.ReplyReview) {
    return "New reply";
  }
  if (type === NotificationType.Disagreement) {
    return "Dispute";
  }
  if (type === NotificationType.SettlementAccepted) {
    return "Settlement accepted";
  }
  if (type === NotificationType.TypeNewMessage) {
    return "New message";
  }
  if (type === NotificationType.SettlementAmountPaid) {
    return "Settlement paid";
  }
  return "New Notification";
  // if(type === NotificationType.TypeDislike){
  //     return "Dislike"
  // }
}
function getSubtitleForNotification(type, from) {
  if (type === NotificationType.TypeNewUser) {
    return from.name + " just signed up";
  }
  if (type === NotificationType.ReplyReview) {
    return "You have a new reply on your review";
  }
  if (type === NotificationType.Disagreement) {
    return "You have a dispute";
  }
  if (type === NotificationType.SettlementAccepted) {
    return "Settlement offer was accepted";
  }
  if (type === NotificationType.TypeNewMessage) {
    return "You have a new message";
  }
  if (type === NotificationType.SettlementAmountPaid) {
    return "Settlement offer was paid";
  }
  return "You have a new notificaiton";
  // if(type === NotificationType.TypeDislike){
  //     return "Dislike"
  // }
}

export const createNotificaiton = async (
  from,
  to,
  itemId,
  notification_type,
  message,
  additionalData = null
) => {
  // const { UserId, actionType, itemId, message } = req.body;
  let fromUser = await db.User.findByPk(from);
  try {
    const notification = await db.Notification.create({
      fromUser: from,
      toUser: to,
      productId: itemId,
      type: notification_type,
      //   is_read: false,
      message: message,
    });
    let sent = await sendNotWithUser(
      to,
      getTitleForNotification(notification_type),
      getSubtitleForNotification(notification_type, fromUser),
      { type: notification_type, data: notification },
      additionalData
    );

    console.log("Sent not to admin ", sent);
    return {
      status: true,
      message: "Notification created successfully.",
      data: notification,
    };
    // res.send({ status: true, message: 'Notification created successfully.', data: notification });
  } catch (err) {
    console.error("Error creating notification:", err);
    return {
      status: false,
      message: "An error occurred while creating the notification.",
      error: err.message,
    };
    // res.status(500).send({ status: false, message: 'An error occurred while creating the notification.', error: err.message });
  }
};

const sendNotWithUser = async (
  to,
  title,
  body,
  data,
  additionalData = null
) => {
  let expo = new Expo();
  let user = await db.User.findByPk(to);
  console.log("Sending not to admin token ", user.fcm_token);
  if (user && user.fcm_token) {
    const message = {
      to: user.fcm_token, //"ExponentPushToken[_pZ2Y6LPv7S9gKi2lJwzif]",
      sound: "default",
      title: title, //'Test Notification',
      body: body, //'This is a test notification message',
      data: { notification: data, additional: additionalData }, //{ message: 'This is a test notification message' },
      // additional: additionalData
    };
    // console.log("Data  is ", JSON.stringify(data))

    try {
      // Send the notification
      let receipts = await expo.sendPushNotificationsAsync([message]);
      //console.log(receipts);
      return {
        status: true,
        message: "Notification sent successfully",
        data: receipts,
      };
    } catch (error) {
      console.error(error);
      return {
        status: false,
        message: "Failed to send notification",
        error: error.message,
      };
      // res.status(500).send({ status: false, message: 'Failed to send notification', error: error.message });
    }
  } else {
    console.log("No user or token", user);
    return {
      status: false,
      message: "Failed to send notification",
      error: "No such user " + to,
    };
  }
};
