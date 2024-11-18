const PurchaseHistory = (sequelize, Sequelize) => {
  const PurchaseHistory = sequelize.define("PurchaseHistory", {
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    isSubscription: {
      type: Sequelize.BOOLEAN,
    },
    productId: {
      type: Sequelize.STRING,
      defaultValue: "",
    },
  });

  // Define associations if needed

  return PurchaseHistory;
};

export default PurchaseHistory;
