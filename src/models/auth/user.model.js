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
      type: Sequelize.STRING, //"customer", "business", "admin"
      defaultValue: "customer",
    },

    accountStatus: {
      type: Sequelize.STRING, //"active", "deleted", "suspended"
      defaultValue: "active",
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
      defaultValue: 5,
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
    originalTransactionId: {
      type: Sequelize.STRING,
      allowNull: true,
      default: null,
    },
    originalPurchaseDate: {
      //miliseconds
      type: Sequelize.STRING,
      allowNull: true,
      default: null,
    },

    plan_status: {
      type: Sequelize.ENUM,
      values: ["free", "monthly", "yearly", "weekly"],
      default: "free",
      allowNull: false,
    },
    provider_id: {
      type: Sequelize.STRING,
      default: "",
    },
    provider_name: {
      type: Sequelize.STRING,
      default: "Email", //Facebook, Apple, Google
    },
    stripeCustomerIdLive: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    stripeCustomerIdTest: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  });

  User.associate = function (models) {
    User.hasMany(models.Review, { foreignKey: "userId", as: "Reviews" });
  };

  // Method to calculate total yapScore for a user
  User.prototype.getTotalYapScore = async function () {
    console.log("Yap loading ", this.id);
    const totalYapScore = await sequelize.models.Review.sum("yapScore", {
      where: { customerId: this.id },
    });
    return totalYapScore || 0; // Return 0 if no reviews are found
  };

  User.prototype.getTotalReviews = async function () {
    console.log("Reviews loading ", this.id);
    let reviews = await sequelize.models.Review.count({
      where: { customerId: this.id },
    });

    return reviews || 0;
  };

  return User;
};

export const AccountStatus = {
  Active: "active",
  Deleted: "deleted",
  Suspended: "suspended",
};

export const UserRole = {
  Customer: "customer",
  Business: "business",
  Admin: "admin",
};

export default User;
