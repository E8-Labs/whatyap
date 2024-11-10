const ReviewImage = (sequelize, Sequelize) => {
  const ReviewImage = sequelize.define("ReviewImage", {
    media_url: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    thumb_url: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    reviewId: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
  });

  // Define associations if needed
  ReviewImage.associate = function (models) {
    ReviewImage.belongsTo(models.Review, {
      as: "Review",
      foreignKey: "reviewId",
    });
  };

  return ReviewImage;
};

export default ReviewImage;
