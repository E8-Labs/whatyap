const SettlementPayments = (sequelize, Sequelize) => {
  const SettlementPayments = sequelize.define("SettlementPayments", {
    userId: {
      // user who paid
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    settlementOfferId: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    tax: {
      // percentage value
      type: Sequelize.DOUBLE,
      allowNull: false,
    },
    settlementOfferAmount: {
      // percentage value
      type: Sequelize.DOUBLE,
      allowNull: false,
    },
    totalAmount: {
      // settlement + tax
      type: Sequelize.DOUBLE,
      allowNull: false,
    },
    status: {
      type: Sequelize.STRING, //""
      defaultValue: "active", // default is active, rejected, paid, requestedChange
    },
    data: {
      type: Sequelize.TEXT("medium"),
      allowNull: true,
    },
  });

  // Define associations if needed
  SettlementPayments.associate = function (models) {
    SettlementPayments.belongsTo(models.User, {
      as: "User",
      foreignKey: "userId",
    });
    // SettlementPayments.belongsTo(models.Sett, {
    //   as: "Review",
    //   foreignKey: "reviewId",
    // });
  };

  return SettlementPayments;
};

export default SettlementPayments;
