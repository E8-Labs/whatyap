// const { Sequelize } = require(".");
const UserMedia = (sequelize, Sequelize) => {
  const UserMediaModel = sequelize.define("UserMedia", {
    url: {
      // we store the full size image or video here
      type: Sequelize.STRING,
    },
    thumb_url: {
      // If it is a video then we store here the thumbnail. If it is an image then we store here thumbnail size image.
      type: Sequelize.STRING,
    },
    caption: {
      type: Sequelize.STRING,
    },
    type: {
      type: Sequelize.ENUM,
      values: ["image", "video"],
      default: "image",
    },
    userId: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "Users", // Table name (plural form)
        key: "id",
      },
    },
  });

  return UserMediaModel;
};

export default UserMedia;
