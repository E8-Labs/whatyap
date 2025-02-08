const Notification = (sequelize, Sequelize) => {
  const Notification = sequelize.define("Notification", {
    type: {
      type: Sequelize.STRING, // NewMessage, ReplyReview, Disagreement, SettlementAccepted, ProfileView
      allowNull: true,
    },
    fromUser: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    productId: {
      type: Sequelize.INTEGER,
      allowNull: true, // Optional field
    },
    toUser: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    isRead: {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  });

  // Define associations
  Notification.associate = function (models) {
    Notification.belongsTo(models.User, {
      as: "FromUser",
      foreignKey: "fromUser",
    });
    Notification.belongsTo(models.User, { as: "ToUser", foreignKey: "toUser" });
  };

  return Notification;
};

export default Notification;
