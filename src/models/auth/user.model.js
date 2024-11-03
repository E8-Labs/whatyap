const User = (sequelize, Sequelize) => {
  const User = sequelize.define("User", {
    name: {
      type: Sequelize.STRING,
      defaultValue: "",
    },
    username: {
      type: Sequelize.STRING,
      defaultValue: "",
    },
    phone: {
      type: Sequelize.STRING,
      defaultValue: "",
    },

    email: {
      type: Sequelize.STRING,
    },
    password: {
      type: Sequelize.STRING,
    },
    role: {
      type: Sequelize.STRING, //"caller", "creator"
      defaultValue: "caller",
    },

    profile_image: {
      // we store smaller image for fast loading here
      type: Sequelize.STRING,
      defaultValue: "",
    },
    full_profile_image: {
      // we store full size image here
      type: Sequelize.STRING,
      defaultValue: "",
    },
    city: {
      // we store smaller image for fast loading here
      type: Sequelize.STRING,
      defaultValue: "",
    },
    driver_license_id: {
      // we store smaller image for fast loading here
      type: Sequelize.STRING,
      defaultValue: "",
    },
    driver_license_image: {
      // we store smaller image for fast loading here
      type: Sequelize.STRING,
      defaultValue: "",
    },
    state: {
      // we store smaller image for fast loading here
      type: Sequelize.STRING,
      defaultValue: "",
    },
    fcm_token: {
      // we store smaller image for fast loading here
      type: Sequelize.STRING,
      defaultValue: "",
    },
    business_industry: {
      // Industry
      type: Sequelize.STRING,
      defaultValue: "",
    },
    business_website: {
      //Website
      type: Sequelize.STRING,
      defaultValue: "",
    },
    business_address: {
      // Location
      type: Sequelize.STRING,
      defaultValue: "",
    },
    about_business: {
      // Some info
      type: Sequelize.STRING,
      defaultValue: "",
    },
    business_employees: {
      // send the upper limit here. Like if user selects 11-50 then send 50
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    credits_available: {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    },
    lat: {
      type: Sequelize.DOUBLE,
      allowNull: true,
    },
    lon: {
      type: Sequelize.DOUBLE,
      allowNull: true,
    },
    addedBy: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
  });

  User.associate = function (models) {
    User.hasMany(models.Review, { foreignKey: "userId" });
  };

  // Method to calculate total yapScore for a user
  User.prototype.getTotalYapScore = async function () {
    const totalYapScore = await sequelize.models.Review.sum("yapScore", {
      where: { userId: this.id },
    });
    return totalYapScore || 0; // Return 0 if no reviews are found
  };
  return User;
};

export default User;
