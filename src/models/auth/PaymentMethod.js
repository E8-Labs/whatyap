// Record the history of user's plans. The last one would be current plan

const PaymentMethod = (sequelize, Sequelize) => {
  const PaymentMethod = sequelize.define("PaymentMethod", {
    paymentMethodId: {
      type: Sequelize.STRING,
      allowNull: true,
    },

    userId: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    status: {
      type: Sequelize.STRING,
      defaultValue: "",
    },
    brand: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    last4: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    exp_month: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    exp_year: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    isDefault: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },

    environment: {
      type: Sequelize.STRING,
      defaultValue: "Sandbox",
    },
  });

  return PaymentMethod;
};

export default PaymentMethod;
