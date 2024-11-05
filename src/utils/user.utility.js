import db from "../models/index.js";

export const getTotalYapScore = async function (user) {
  console.log("Yap loading ", this.id);
  const totalYapScore = await db.Review.sum("yapScore", {
    where: { customerId: user.id },
  });
  return totalYapScore || 0; // Return 0 if no reviews are found
};

export const getTotalReviews = async function (user) {
  console.log("Reviews loading ", this.id);
  let reviews = await db.Review.count({
    where: { customerId: user.id },
  });

  return reviews || 0;
};
