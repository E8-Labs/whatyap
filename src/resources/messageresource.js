import db from "../models/index.js";
import UserProfileLiteResource from "./userprofileliteresource.js";

const Op = db.Sequelize.Op;

const MessageResource = async (user, currentUser = null) => {
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

async function getUserData(message, currentUser = null) {
  let user = await db.User.findByPk(message.userId);
  let resource = await UserProfileLiteResource(user);
  const UserFullResource = {
    ...message.dataValues,
    user: resource,
  };

  return UserFullResource;
}

export default MessageResource;
