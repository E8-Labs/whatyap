// models/ReportedUsers.js
const Subscription = (sequelize, Sequelize) => {
  const Subscription = sequelize.define("Subscription", {
    userId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users",
        key: "id",
      },
    },
    originalTransactionId: {
      type: Sequelize.STRING,
      default: "",
    },
    originalPurchaseDate: {
      type: Sequelize.STRING,
      default: "",
    },
    plan: Sequelize.STRING,
    status: Sequelize.STRING,
    startDate: Sequelize.DATE,
    endDate: Sequelize.DATE,
  });

  Subscription.associate = (models) => {
    Subscription.hasMany(models.SubscriptionHistory, {
      foreignKey: "subscriptionId",
      onDelete: "CASCADE",
    });
  };

  return Subscription;
};

export default Subscription;
