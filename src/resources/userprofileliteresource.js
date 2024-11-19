import db from "../models/index.js";
import {
  getTotalYapScore,
  getTotalReviews,
  getTotalSpent,
  Get3DigitYapScore,
} from "../utils/user.utility.js";

const Op = db.Sequelize.Op;

const UserProfileLiteResource = async (user, currentUser = null) => {
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
  let totalYapScore = 0;
  let reviews = 0;
  let yapScore3Digit = 0;
  // if (user instanceof db.User) {
  totalYapScore = await getTotalYapScore(user);
  reviews = await getTotalReviews(user);
  if (reviews != 0) {
    yapScore3Digit = Get3DigitYapScore(reviews, totalYapScore / reviews);
  }
  // }
  console.log("Getting user lite res");
  const UserFullResource = {
    id: user.id,
    name: user.name,
    profile_image: user.profile_image,
    full_profile_image: user.full_profile_image,
    email: user.email,
    phone: user.phone,
    role: user.role,
    city: user.city,
    state: user.state,
    totalYapScore: totalYapScore,
    totalReviews: reviews,
    createdAt: user.createdAt,
    totalSpent: await getTotalSpent(user),
    yapScore3Digit: yapScore3Digit,
  };

  return UserFullResource;
}

export default UserProfileLiteResource;
