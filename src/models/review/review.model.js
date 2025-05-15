const Review = (sequelize, Sequelize) => {
  const Review = sequelize.define("Review", {
    // Your column definitions
    service: { type: Sequelize.STRING, allowNull: false },
    amountOfTransaction: { type: Sequelize.DOUBLE, allowNull: false },
    dateOfTransaction: { type: Sequelize.STRING, allowNull: false },
    mediaUrl: { type: Sequelize.STRING, allowNull: true },
    thumbUrl: { type: Sequelize.STRING, allowNull: true },
    yapScore: { type: Sequelize.DOUBLE, allowNull: false },
    settlementOffer: { type: Sequelize.BOOLEAN, defaultValue: false },
    notesAboutCustomer: { type: Sequelize.TEXT, defaultValue: "" },
    userId: { type: Sequelize.INTEGER, allowNull: true },
    customerId: { type: Sequelize.INTEGER, allowNull: true },
    settlementAmount: { type: Sequelize.DOUBLE, allowNull: true },
    reviewStatus: { type: Sequelize.STRING, defaultValue: "active" },
    newActivityByCustomer: { type: Sequelize.BOOLEAN, defaultValue: false },
    newActivityByBusiness: { type: Sequelize.BOOLEAN, defaultValue: false },
    disputeReason: { type: Sequelize.STRING, allowNull: true },
  });

  // Define associations with distinct aliases
  Review.associate = function (models) {
    Review.belongsTo(models.User, { as: "User", foreignKey: "userId" });
    Review.belongsTo(models.User, {
      as: "CustomerUser",
      foreignKey: "customerId",
    });
  };

  return Review;
};

export default Review;
