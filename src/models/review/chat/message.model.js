const Message = (sequelize, Sequelize) => {
  const Message = sequelize.define(
    "Message",
    {
      message: {
        type: Sequelize.STRING, //""
        defaultValue: "",
      },
      media: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      voice: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      messageType: {
        type: Sequelize.STRING,
        defaultValue: "Text",
      },
      emoji: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      settlementOfferId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      chatId: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
    },
    {
      charset: "utf8mb4",
      collate: "utf8mb4_unicode_ci",
    }
  );

  // Define associations if needed
  Message.associate = function (models) {
    Message.belongsTo(models.User, {
      as: "User",
      foreignKey: "userId",
    });
    Message.belongsTo(models.Chat, {
      as: "Chat",
      foreignKey: "chatId",
    });
  };

  return Message;
};

export default Message;
