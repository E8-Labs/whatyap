import db from "../models/index.js";
// import S3 from "aws-sdk/clients/s3.js";
import JWT from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import moment from "moment-timezone";
import axios from "axios";
import chalk from "chalk";
import nodemailer from "nodemailer";
import UserProfileFullResource from "../resources/userprofilefullresource.js";
// import UserSubscriptionResource from "../resources/usersubscription.resource.js";
// import TeamResource from "../resources/teamresource.js";
// import UserSubscriptionResource from "../resources/UserSubscriptionResource.js";
import * as stripe from "../services/stripe.js";

const User = db.User;
const Op = db.Sequelize.Op;

export const AddCard = async (req, res) => {
  //console.log("Add card api");
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      let token = req.body.source;
      console.log("Add Card Token is ", token);
      try {
        let card = await stripe.createCard(user, token);

        if (card && typeof card.brand != "undefined") {
          res.send({
            status: true,
            message: "Card added",
            data: card,
          });
        } else {
          res.send({
            status: false,
            message: card.error,
            data: card,
          });
        }
      } catch (error) {
        res.send({
          status: false,
          message: "Card not added",
          data: error,
        });
      }
    } else {
      res.send({
        status: false,
        message: "Unauthenticated user",
        data: null,
      });
    }
  });
};

export const DeleteCard = async (req, res) => {
  //console.log("Delete card api");
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      let cardId = req.body.cardId;
      //console.log("User deleting card ", cardId);
      let cardDeleted = await stripe.deleteCard(user, cardId);

      res.send({
        status: true,
        message: cardDeleted !== null ? "Card deleted" : "Card not deleted",
        data: cardDeleted,
      });
    }
  });
};

export const GetUserPaymentSources = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      let customer = await stripe.createCustomer(user);
      const defaultPaymentMethodId =
        customer.invoice_settings.default_payment_method;
      let cards = await stripe.loadCards(user);
      let paymentMethodsWithDefault = [];
      if (cards) {
        paymentMethodsWithDefault = cards.map((paymentMethod) => {
          let card = paymentMethod.card;
          return {
            id: paymentMethod.id,
            brand: card.brand,
            last4: card.last4,
            exp_month: card.exp_month,
            exp_year: card.exp_year,
            isDefault: paymentMethod.id === defaultPaymentMethodId, // Mark if this is the default
          };
        });
      }

      ////console.log("cards loaded ", cards)
      res.send({
        status: true,
        message: "Card loaded",
        data: paymentMethodsWithDefault,
        default: defaultPaymentMethodId,
      });
    }
  });
};

export const MakeDefaultPaymentMethod = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (authData) {
      let user = await db.User.findByPk(authData.user.id);
      // let customer = await stripe.createCustomer(user)
      let cardId = req.body.cardId;
      // const defaultPaymentMethodId = customer.invoice_settings.default_payment_method;
      let customer = await stripe.setDefaultPaymentMethod(user, cardId);
      ////console.log("cards loaded ", cards)
      res.send({ status: true, message: "Card set default", data: customer });
    } else {
      res.send({
        status: false,
        message: `Unauthenticated User`,
        data: null,
      });
    }
  });
};

export const GetTransactions = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (error) {
      res.send({ status: false, message: "Unauthenticated user", data: null });
    } else {
      let user = await db.User.findByPk(authData.user.id);
      let customerId = user.customerId || null;
      if (customerId) {
        let transactions = await db.TransactionModel.findAll({
          where: {
            customerId: customerId,
          },
        });
        return res.send({
          status: true,
          message: "Transactions obtained",
          data: transactions,
        });
      } else {
        res.send({
          status: true,
          message: "User don't have transactions",
          data: null,
        });
      }
    }
  });
};

export const DownloadInvoice = async (req, res) => {
  let invoiceId = req.body.invoiceId;
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (error) {
      res.send({ status: false, message: "Unauthenticated user", data: null });
    } else {
      let userId = authData.user.id;

      let t = await db.TransactionModel.findOne({
        where: {
          invoiceId: invoiceId,
        },
      });
      if (t && t.invoiceUrl != null && t.invoiceUrl != "") {
        res.send({
          status: true,
          message: "Invoice already generated",
          data: { url: t.invoiceUrl },
        });
      } else {
        let url = await stripe.createInvoicePdf(invoiceId);
        const [updated] = await db.TransactionModel.update(
          { invoiceUrl: url },
          { where: { invoiceId } }
        );
        res.send({
          status: true,
          message: "Invoice generated",
          data: { url: url },
        });
      }
    }
  });
};

export const PaySettlement = async (req, res) => {
  JWT.verify(req.token, process.env.SecretJwtKey, async (error, authData) => {
    if (error) {
      res.send({ status: false, message: "Unauthenticated user", data: null });
    } else {
      let user = await db.User.findByPk(authData.user.id);
      const { settlementId } = req.body; // Assume settlementId is passed in the request body
      const userId = user.id;
      let settlement = await db.SettlementOffer.findByPk(settlementId);
      if (!settlement) {
        return res.send({
          status: false,
          message: "No such settlement",
          data: null,
        });
      }

      try {
        // Fetch the product from the database

        let seller = await db.User.findByPk(product.userId);

        if (!product) {
          return res.send({ status: false, message: "Product not found" });
        }

        // Fetch the user profile to get the customerId
        const user = await db.User.findOne({ where: { id: userId } });

        if (!user) {
          return res.send({ status: false, message: "Customer not found" });
        }

        // Check if stripeProductId is empty
        if (!product.stripeProductId) {
          // Create a new product in Stripe
          // const stripeProduct = await stripe.products.create({
          //   name: product.name,
          //   description: `Product for ${product.name}`,
          // });
          let stripeProduct = await stripe.createProductAndPaymentLink(
            userId,
            product.name,
            `Buy ${product.name} at $${product.productPrice}`,
            Number(product.productPrice),
            "image"
          );
          // Create a price for the product
          // const stripePrice = await stripe.prices.create({
          //   product: stripeProduct.id,
          //   unit_amount: Math.round(product.productPrice * 100), // Stripe requires the amount in cents
          //   currency: "usd", // Adjust the currency as needed
          // });

          // Update the product in the database with the Stripe product and price IDs
          product.stripeProductId = stripeProduct.productId;
          product.stripePriceId = stripeProduct.priceId;
          await product.save();
        }

        let customer = await stripe.createCustomer(
          user,
          "buy product payment controller"
        );
        // Create a payment intent for the product

        let defaultPaymentMethodId =
          customer.invoice_settings.default_payment_method;
        if (!defaultPaymentMethodId) {
          // if no default payment method
          let cards = await stripe.loadCards(user);

          if (cards.length === 0) {
            return res.send({
              status: false,
              message: "No payment source found",
              data: null,
            });
          }
          defaultPaymentMethodId = cards[0].id;
        }
        let stripeInstance = await stripe.getStripe();
        const paymentIntent = await stripeInstance.paymentIntents.create({
          amount: Math.round(product.productPrice * 100), // Amount in cents
          currency: "usd", // Adjust the currency as needed
          customer: customer.id, // Stripe customer ID
          payment_method_types: ["card"],
          payment_method: defaultPaymentMethodId,
          off_session: true, // Set to true to indicate that this is an off-session payment (like saving cards)
          confirm: true, // Automatically confirms the payment
          description: `Purchase of ${product.name}`,
        });
        //console.log("payment intent", paymentIntent);
        if (paymentIntent) {
          let purchasedProduct = await db.PurchasedProduct.create({
            userId: user.id,
            productId: product.id,
            productPrice: product.productPrice,
            paymentIntentId: paymentIntent.id,
            data: JSON.stringify(paymentIntent),
            status: paymentIntent.status,
            livemode: paymentIntent.livemode,
          });
          let sent = await SendPurchaseEmailToCreator(
            product,
            purchasedProduct,
            seller,
            user
          );
          let sentToBuyer = await SendPurchaseEmailToBuyer(
            product,
            purchasedProduct,
            seller,
            user
          );
        }

        // Respond with the payment intent client secret
        return res.send({
          status: true,
          message: "Payment intent created",
          // clientSecret: paymentIntent.client_secret,
          intent: paymentIntent,
        });
      } catch (error) {
        console.error("Error processing payment:", error);
        return res
          .status(500)
          .send({ status: false, message: "Payment processing failed", error });
      }
    }
  });
};

export const SendPurchaseEmailToCreator = async (
  product,
  purchase,
  seller,
  buyer
) => {
  let email = seller.email;
  let productName = product.name;
  let customerName = buyer.name;
  if (customerName == null || customerName == "") {
    customerName = buyer.email;
  }

  let sellerName = seller.name;
  if (sellerName == null || sellerName == "") {
    sellerName = seller.email;
  }

  let purchaseDate = purchase.createdAt;

  if (!seller) {
    // res.send({ status: false, data: null, message: "Email not found" });
    return { status: false, data: null, message: "Email not found" };
  }

  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "salman@e8-labs.com",
      pass: "uzmvwsljflyqnzgu",
    },
  });

  try {
    let mailOptions = {
      from: '"Store Notification" <Voice.ai>',
      to: email,
      subject: "New Product Purchase Notification",
      text: `Dear ${sellerName},\n\nA product has just been purchased from your store. Please find the details below and take the necessary actions to provide the respective service.\n\nProduct Name: ${productName}\nCustomer Name: ${customerName}\nPurchase Date: ${purchaseDate}\n\nThank you for your prompt attention to this matter.\n\nBest Regards,\nYour Store Team`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Purchase Notification</title>
  <style>
      body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
      }
      .container {
          max-width: 600px;
          margin: 50px auto;
          background-color: #ffffff;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      }
      .header {
          text-align: center;
          padding: 20px 0;
          background-color: #28a745;
          color: white;
          border-radius: 8px 8px 0 0;
      }
      .header h1 {
          margin: 0;
          font-size: 24px;
      }
      .content {
          padding: 20px;
      }
      .content p {
          font-size: 16px;
          line-height: 1.6;
          color: #333333;
      }
      .content .details {
          margin: 20px 0;
          padding: 10px;
          background-color: #f9f9f9;
          border-left: 4px solid #28a745;
          border-radius: 4px;
      }
      .footer {
          text-align: center;
          padding: 20px;
          font-size: 14px;
          color: #777777;
      }
      .footer a {
          color: #007BFF;
          text-decoration: none;
      }
      .footer a:hover {
          text-decoration: underline;
      }
  </style>
</head>
<body>
  <div class="container">
      <div class="header">
          <h1>New Purchase Notification</h1>
      </div>
      <div class="content">
          <p>Dear ${sellerName},</p>
          <p>A product has just been purchased from your store. Please find the details below and take the necessary actions to provide the respective service.</p>
          <div class="details">
              <p><strong>Product Name:</strong> ${productName}</p>
              <p><strong>Product Price:</strong> $${product.productPrice}</p>
              <p><strong>Customer Name:</strong> ${customerName}</p>
              <p><strong>Purchase Date:</strong> ${purchaseDate}</p>
          </div>
          <p>Thank you for your prompt attention to this matter.</p>
          <p>Best Regards,<br>Your Store Team</p>
      </div>
      <div class="footer">
          <p>If you have any questions, please <a href="mailto:salman@e8-labs.com">contact us</a>.</p>
      </div>
  </div>
</body>
</html>
`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return { status: false, message: "Email not sent" };
      } else {
        return { status: true, message: "Purchase notification sent" };
      }
    });
  } catch (error) {
    //console.log("Exception email", error);
    return { status: false, message: "An error occurred" };
  }
};

export const SendPurchaseEmailToBuyer = async (
  product,
  purchase,
  seller,
  buyer
) => {
  let buyerEmail = buyer.email;
  let productName = product.name;
  let customerName = buyer.name;
  if (customerName == null || customerName == "") {
    customerName = buyer.email;
  }

  let sellerName = seller.name;
  if (sellerName == null || sellerName == "") {
    sellerName = seller.email;
  }

  let purchaseDate = purchase.createdAt;
  let productPrice = product.productPrice;

  if (!buyer) {
    return { status: false, data: null, message: "Buyer email not found" };
  }

  let transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "salman@e8-labs.com",
      pass: "uzmvwsljflyqnzgu",
    },
  });

  try {
    let mailOptions = {
      from: '"Store Notification" <Voice.ai>',
      to: buyerEmail,
      subject: `Purchase Receipt for ${sellerName}`,
      text: `Hey ${customerName},\n\nThis is a confirmation of your recent purchase from ${sellerName}'s store. Below are the details of your purchase:\n\nProduct Name: ${productName}\nAmount: $${productPrice}\nPurchase Date: ${purchaseDate}\n\nThank you for your purchase!\n\nBest Regards,\nYour Store Team`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Purchase Confirmation</title>
  <style>
      body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
      }
      .container {
          max-width: 600px;
          margin: 50px auto;
          background-color: #ffffff;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      }
      .header {
          text-align: center;
          padding: 20px 0;
          background-color: #28a745;
          color: white;
          border-radius: 8px 8px 0 0;
      }
      .header h1 {
          margin: 0;
          font-size: 24px;
      }
      .content {
          padding: 20px;
      }
      .content p {
          font-size: 16px;
          line-height: 1.6;
          color: #333333;
      }
      .content .details {
          margin: 20px 0;
          padding: 10px;
          background-color: #f9f9f9;
          border-left: 4px solid #28a745;
          border-radius: 4px;
      }
      .footer {
          text-align: center;
          padding: 20px;
          font-size: 14px;
          color: #777777;
      }
      .footer a {
          color: #007BFF;
          text-decoration: none;
      }
      .footer a:hover {
          text-decoration: underline;
      }
  </style>
</head>
<body>
  <div class="container">
      <div class="header">
          <h1>Purchase Confirmation</h1>
      </div>
      <div class="content">
          <p>Hey ${customerName},</p>
          <p>This is a confirmation of your recent purchase from ${sellerName}'s store. Below are the details of your purchase:</p>
          <div class="details">
              <p><strong>Product Name:</strong> ${productName}</p>
              <p><strong>Amount:</strong> $${productPrice}</p>
              <p><strong>Purchase Date:</strong> ${purchaseDate}</p>
          </div>
          <p>Thank you for your purchase!</p>
          <p>Best Regards,<br>Your Store Team</p>
      </div>
      <div class="footer">
          <p>If you have any questions, please <a href="mailto:salman@e8-labs.com">contact us</a>.</p>
      </div>
  </div>
</body>
</html>
`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        return { status: false, message: "Email not sent" };
      } else {
        return { status: true, message: "Purchase receipt sent to buyer" };
      }
    });
  } catch (error) {
    //console.log("Exception email", error);
    return { status: false, message: "An error occurred" };
  }
};
