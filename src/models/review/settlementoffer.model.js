const SettlementOffer = (sequelize, Sequelize) => {
  const SettlementOffer = sequelize.define("SettlementOffer", {
    amount: {
      type: Sequelize.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },

    userId: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    reviewId: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },

    status: {
      type: Sequelize.STRING, //""
      defaultValue: "active", // default is active, rejected, paid, requestedChange
    },
  });

  // Define associations if needed
  SettlementOffer.associate = function (models) {
    SettlementOffer.belongsTo(models.User, {
      as: "User",
      foreignKey: "userId",
    });
    SettlementOffer.belongsTo(models.Review, {
      as: "Review",
      foreignKey: "reviewId",
    });
  };

  return SettlementOffer;
};

export default SettlementOffer;
