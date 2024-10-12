const ProfileView = (sequelize, Sequelize) => {
  const ProfileView = sequelize.define("ProfileView", {
    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    viewedUserId: {
      type: Sequelize.INTEGER,
      allowNull: false,
    },
    viewedAt: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW,
    },
//     viewerdUserId: {
//       type: Sequelize.INTEGER,
//       allowNull: true,
//       references: {
//         model: "Users", // Table name (plural form)
//         key: "id",
//       },
//     },
//     viewedUserId: {
//         type: Sequelize.INTEGER,
//         allowNull: true,
//         references: {
//           model: "Users", // Table name (plural form)
//           key: "id",
//         },
//       },
  });

  // Define associations if needed
  ProfileView.associate = function (models) {
    ProfileView.belongsTo(models.User, { as: "User", foreignKey: "userId" });
    ProfileView.belongsTo(models.User, {
      as: "ViewedUser",
      foreignKey: "viewedUserId",
    });
  };

  return ProfileView;
};

export default ProfileView;
