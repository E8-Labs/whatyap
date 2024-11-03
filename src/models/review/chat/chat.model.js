const Chat = (sequelize, Sequelize) => {
  const Chat = sequelize.define("Chat", {
    businessId: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    customerId: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    reviewId: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },

    lastMessage: {
      type: Sequelize.STRING, //""
      defaultValue: "",
    },
    emoji: {
      type: Sequelize.STRING, //""
      allowNull: true,
    },
  });

  // Define associations if needed
  Chat.associate = function (models) {
    Chat.belongsTo(models.User, {
      as: "Business",
      foreignKey: "businessId",
    });
    Chat.belongsTo(models.User, {
      as: "Customer",
      foreignKey: "customerId",
    });
    Chat.belongsTo(models.Review, {
      as: "Review",
      foreignKey: "reviewId",
    });
  };

  return Chat;
};

export default Chat;
