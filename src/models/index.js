import dbConfig from "../config/db.config.js";
import User from "./auth/user.model.js";
import UserMedia from "./auth/usermedia.model.js";
import EmailVerificationCode from "./auth/emailverificationcode.model.js";
import ProfileView from "./auth/profileview.model.js";
import SearchHistory from "./auth/searchhistory.model.js";
import Review from "./review/review.model.js";
import SettlementOffer from "./review/settlementoffer.model.js";

import Sequelize from "sequelize";
import Chat from "./review/chat/chat.model.js";
import Message from "./review/chat/message.model.js";
import Notification from "./notifications/notification.model.js";
import Subscription from "./auth/Subscription.model.js";
import SubscriptionHistory from "./auth/SubscriptionHistory.model.js";

const sequelize = new Sequelize(
  dbConfig.MYSQL_DB,
  dbConfig.MYSQL_DB_USER,
  dbConfig.MYSQL_DB_PASSWORD,
  {
    host: dbConfig.MYSQL_DB_HOST,
    port: dbConfig.MYSQL_DB_PORT,
    dialect: dbConfig.dialect,
    logging: false,
  }
);

try {
  await sequelize.authenticate();
  console.log("Connection has been established successfully.");
} catch (error) {
  console.error("Unable to connect to the database:", error);
}

const db = {};
let models = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = User(sequelize, Sequelize);
models["User"] = db.User;

db.UserMedia = UserMedia(sequelize, Sequelize);
models["UserMedia"] = db.UserMedia;

db.EmailVerificationCode = EmailVerificationCode(sequelize, Sequelize);
models["EmailVerificationCode"] = db.EmailVerificationCode;

db.ProfileView = ProfileView(sequelize, Sequelize);
models["ProfileView"] = db.ProfileView;

db.SearchHistory = SearchHistory(sequelize, Sequelize);
models["SearchHistory"] = db.SearchHistory;

db.Review = Review(sequelize, Sequelize);
models["Review"] = db.Review;

db.SettlementOffer = SettlementOffer(sequelize, Sequelize);
models["SettlementOffer"] = db.SettlementOffer;

db.Notification = Notification(sequelize, Sequelize);
models["Notification"] = db.Notification;

db.Subscription = Subscription(sequelize, Sequelize);
models["Subscription"] = db.Subscription;

db.SubscriptionHistory = SubscriptionHistory(sequelize, Sequelize);
models["SubscriptionHistory"] = db.SubscriptionHistory;

db.Chat = Chat(sequelize, Sequelize);
models["Chat"] = db.Chat;

db.Message = Message(sequelize, Sequelize);
models["Message"] = db.Message;

Object.keys(models).forEach((modelName) => {
  if (models[modelName].associate) {
    models[modelName].associate(models);
  }
});

export default db;
