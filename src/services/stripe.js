import StripeSdk from "stripe";
import axios from "axios";
import qs from "qs";
import db from "../models/index.js";

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import Stripe from "stripe";
// import logo from '../assets/applogo.png'

const AppSuffix = "";
const AppPrefix = "Whaty_";
const environment = process.env.Environment;
const IsTestEnvironment = process.env.Environment == "Sandbox";

// Initialize Stripe for both environments
const stripeTest = new Stripe(process.env.STRIPE_SK_TEST);
const stripeLive = new Stripe(process.env.STRIPE_SK_PRODUCTION);

/**
 * Get Stripe client based on environment
 * @param {string} environment - Either "Sandbox" or "Production".
 */
const getStripeClient = () => {
  //let environment = process.env.Environment;
  return environment === "Sandbox" ? stripeTest : stripeLive;
};

export const generateStripeCustomerId = async (userId) => {
  //let environment = process.env.Environment;
  const stripe = getStripeClient();

  const user = await db.User.findOne({ where: { id: userId } });
  if (!user) throw new Error("User not found.");

  // Check if customer ID already exists for the given environment
  const stripeCustomerIdKey =
    environment === "Sandbox" ? "stripeCustomerIdTest" : "stripeCustomerIdLive";
  if (user[stripeCustomerIdKey]) {
    return user[stripeCustomerIdKey];
  }

  // Create a new customer in Stripe
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
  });

  // Save the customer ID to the appropriate column
  user[stripeCustomerIdKey] = customer.id;
  await user.save();

  return customer.id;
};

/**
 * Get the Stripe customer ID for a user
 * @param {number} userId - The user's ID.
 */
export const getStripeCustomerId = async (userId) => {
  //let environment = process.env.Environment;
  const user = await db.User.findOne({ where: { id: userId } });
  if (!user) throw new Error("User not found.");

  const stripeCustomerIdKey =
    environment === "Sandbox" ? "stripeCustomerIdTest" : "stripeCustomerIdLive";

  if (!user[stripeCustomerIdKey]) {
    return await generateStripeCustomerId(userId);
  }

  return user[stripeCustomerIdKey];
};

//Tags: AddCard, AddPaymentSource
//
export const addPaymentMethod = async (user, token) => {
  const stripe = getStripeClient();
  const stripeCustomerId = await getStripeCustomerId(user.id);

  try {
    let paymentMethod;

    // Attempt to create a new payment method using the provided token
    try {
      paymentMethod = await stripe.paymentMethods.create({
        type: "card",
        card: { token },
      });
    } catch (createError) {
      // If creation fails, try retrieving the payment method using the token
      paymentMethod = await stripe.paymentMethods.retrieve(token);
    }

    // Attach the payment method to the customer if it's not already attached
    if (paymentMethod.customer !== stripeCustomerId) {
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: stripeCustomerId,
      });
    }

    // Perform a $1 authorization to validate the card
    // const authorization = await stripe.paymentIntents.create({
    //   amount: 100, // $1.00 in cents
    //   currency: "usd",
    //   payment_method: paymentMethod.id,
    //   customer: stripeCustomerId,
    //   capture_method: "manual", // Authorize only, do not capture
    //   confirm: true,
    //   automatic_payment_methods: {
    //     enabled: true,
    //     allow_redirects: "never", // Disable redirects
    //   },
    //   //   The return_url is used when the payment flow involves redirect-based authentication methods such as 3D Secure. For cards requiring 3D Secure, the user is redirected to their bank or card issuer's authentication page (e.g., for entering a password or an OTP). Once the authentication is complete, the user is redirected back to your application using the return_url.
    //   //   return_url: `${process.env.FRONTEND_URL}/payment-result`, // Optional: Provide a return URL for redirect-based methods
    // });

    // // Check the authorization status
    // if (authorization.status !== "requires_capture") {
    //   throw new Error("The card does not have sufficient funds or is invalid.");
    // }

    // // Cancel the authorization after successful validation
    // await stripe.paymentIntents.cancel(authorization.id);

    // Set the payment method as the default if none exists

    const customer = await stripe.customers.retrieve(stripeCustomerId);
    let isDefault = false;
    if (!customer.invoice_settings.default_payment_method) {
      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethod.id,
        },
      });
      isDefault = true;
    }

    const formattedMethod = {
      paymentMethodId: paymentMethod.id,
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      exp_month: paymentMethod.card.exp_month,
      exp_year: paymentMethod.card.exp_year,
      userId: user.id,
      isDefault: isDefault, //method.id === defaultPaymentMethodId, // Check if it's the default method
      environment: process.env.Environment,
    };

    await db.PaymentMethod.create(formattedMethod);

    return {
      status: true,
      message: "Payment method added successfully.",
      data: formattedMethod,
    };
  } catch (error) {
    console.error("Error adding payment method:", error.message);
    return {
      status: false,
      message: "Failed to add payment method.",
      error: error.message,
    };
  }
};

export const deleteCard = async (user, cardId) => {
  let key =
    process.env.Environment === "Sandbox"
      ? process.env.STRIPE_SK_TEST
      : process.env.STRIPE_SK_PRODUCTION;

  try {
    const stripe = getStripeClient();
    let customer = await getStripeCustomerId(user.id);

    if (!customer) {
      console.error("Customer not found for user:", user);
      return null;
    }

    //console.log("Deleting card for customer:", customer.id);
    //console.log("Card ID to delete:", cardId);

    // Use paymentMethods.detach to delete a card from the PaymentMethods API
    const deleted = await stripe.paymentMethods.detach(cardId);

    //console.log("Deleted card response:", deleted);
    return deleted;
  } catch (error) {
    console.error(
      "Error deleting card:",
      error.response ? error.response.data : error.message
    );
    return null;
  }
};

export const getPaymentMethods = async (user, environment) => {
  const stripe = getStripeClient(environment);
  const userId = user.id;
  try {
    // Retrieve the Stripe customer ID
    const stripeCustomerId = await getStripeCustomerId(userId, environment);

    // Fetch payment methods for the customer
    const paymentMethodsResponse = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: "card",
      limit: 20,
    });

    const paymentMethods = paymentMethodsResponse.data;

    if (!paymentMethods.length) {
      return {
        status: false,
        message: "No payment methods found.",
        data: [],
      };
    }

    // Retrieve the customer to determine the default payment method
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    const defaultPaymentMethodId =
      customer.invoice_settings.default_payment_method;

    // Format the response
    const formattedMethods = paymentMethods.map((method) => ({
      paymentMethodId: method.id,
      brand: method.card.brand,
      last4: method.card.last4,
      exp_month: method.card.exp_month,
      exp_year: method.card.exp_year,
      isDefault: method.id === defaultPaymentMethodId, // Check if it's the default method
    }));

    return {
      status: true,
      message: "Payment methods retrieved successfully.",
      data: formattedMethods,
    };
  } catch (error) {
    console.error("Error retrieving payment methods:", error.message);
    return {
      status: false,
      message: "Failed to retrieve payment methods.",
      error: error.message,
      data: [],
    };
  }
};
// description: 'Charge for purchasing Product XYZ', // Reason for the charge
// metadata: {
//   product_id: 'prod_ABC123',
//   product_name: 'Product XYZ',
//   product_description: 'This is a detailed description of Product XYZ',
//   order_id: 'order_987654321',
// },

export async function ChargeCustomer(
  amount,
  user,
  title = "",
  description = "",
  paymentMethod = null
) {
  let amountInCents = amount * 100;
  let key = IsTestEnvironment
    ? process.env.STRIPE_SK_TEST
    : process.env.STRIPE_SK_PRODUCTION;

  try {
    if (!key) {
      console.error("Stripe API key is missing.");
      return { status: false, message: "Stripe API key is missing." };
    }

    const stripe = getStripeClient();
    let customerId = await getStripeCustomerId(user.id);

    if (!customerId) {
      return { status: false, message: "No customer found for this user." };
    }

    let paymentMethods = [];

    if (paymentMethod) {
      // If a payment method is provided, try it first
      paymentMethods.push(paymentMethod);
    } else {
      // Fetch all available payment methods (cards) for the customer
      const storedPaymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: "card",
      });

      if (storedPaymentMethods?.data?.length) {
        paymentMethods = storedPaymentMethods.data.map((pm) => pm.id);
      } else {
        return {
          status: false,
          message: "No saved payment methods found for this customer.",
        };
      }
    }

    // Try each payment method one by one until one succeeds
    for (let paymentMethodId of paymentMethods) {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amountInCents),
          currency: "usd",
          customer: customerId,
          payment_method: paymentMethodId,
          confirm: true,
          description: description,
          capture_method: "automatic",
          metadata: {
            product_name: title,
            product_description: description,
          },
          automatic_payment_methods: {
            enabled: true, // Allow automatic handling of payment methods
            allow_redirects: "never", // Prevent redirect-based payment methods
          },
        });

        if (paymentIntent.status === "succeeded") {
          return {
            status: true,
            message: "Charge was successful.",
            reason: "succeeded",
            payment: paymentIntent,
            paymentMethodId: paymentMethodId,
          };
        }
      } catch (error) {
        console.warn(
          `Charge failed for payment method ${paymentMethodId}: ${error.message}`
        );
      }
    }

    // If none of the payment methods worked
    return { status: false, message: "All available payment methods failed." };
  } catch (error) {
    return {
      status: false,
      message: `Charge failed: ${error.message}`,
      reason: error.type || "unknown_error",
      payment: null,
    };
  }
}

export async function setDefaultPaymentMethod(user, paymentMethodId) {
  try {
    let key =
      process.env.Environment === "Sandbox"
        ? process.env.STRIPE_SK_TEST
        : process.env.STRIPE_SK_PRODUCTION;
    ////console.log("Key is ", key)
    const stripe = StripeSdk(key);
    // Fetch the user profile to get the customerId
    // const user = await db.User.findOne({ where: { id: user.id } });

    let customer = await createCustomer(user);
    // Attach the payment method to the customer, if not already attached
    // await stripe.paymentMethods.attach(paymentMethodId, { customer: user.customerId });

    // Set the default payment method
    //console.log("Setting default ", paymentMethodId)
    const customerUpdated = await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    //console.log('Default payment method set successfully:', customerUpdated);
    return customerUpdated;
    // return { status: true, message: 'Default payment method set successfully', customer };
  } catch (error) {
    console.error("Error setting default payment method:", error);
    return null;
    // return { status: false, message: 'Error setting default payment method', error };
  }
}

export const createInvoicePdf = async (invoiceId) => {
  let key =
    process.env.Environment === "Sandbox"
      ? process.env.STRIPE_SK_TEST
      : process.env.STRIPE_SK_PRODUCTION;
  ////console.log("Key is ", key)
  const stripe = StripeSdk(key);
  // Retrieve the invoice from Stripe
  const invoice = await stripe.invoices.retrieve(invoiceId);

  // Define the directory to store the PDF
  let dir = process.env.DocsDir; //'../uploads/documents'//'/var/www/neo/neoapis/uploads/documents'
  const docDir = path.join(dir + "/documents");

  // Ensure the directory exists
  if (!fs.existsSync(docDir)) {
    fs.mkdirSync(docDir, { recursive: true });
  }

  // Define the file name and path
  const mediaFilename = `${invoiceId}.pdf`;
  const docPath = path.join(docDir, mediaFilename);

  // Create a new PDF document
  const doc = new PDFDocument();
  doc.pipe(fs.createWriteStream(docPath));

  // Add content to the PDF
  // Header
  doc
    .image("src/assets/applogo.png", 50, 45, { width: 50 }) // Add your logo path
    .fontSize(20)
    .text("Neo AI", 110, 57)
    .fontSize(10)
    .text("123 Your Street", 200, 65, { align: "right" })
    .text("City, State, ZIP Code", 200, 80, { align: "right" })
    .text("Phone: (555) 555-5555", 200, 95, { align: "right" })
    .moveDown();

  // Invoice title
  doc.fontSize(20).text("INVOICE", 50, 160);

  // Invoice details
  doc
    .fontSize(10)
    .text(`Invoice ID: ${invoice.id}`, 50, 200)
    .text(
      `Invoice Date: ${new Date(invoice.created * 1000).toLocaleDateString()}`,
      50,
      215
    )
    .text(
      `Due Date: ${new Date(invoice.due_date * 1000).toLocaleDateString()}`,
      50,
      230
    )
    .moveDown();

  // Customer details
  doc
    .text(`Bill To:`, 50, 270)
    .text(`Customer ID: ${invoice.customer}`, 50, 285)
    .moveDown();

  // Table for items
  const tableTop = 330;
  const itemCodeX = 50;
  const descriptionX = 260;
  const amountX = 450;

  doc
    .fontSize(10)
    .text("Item Code", itemCodeX, tableTop)
    .text("Description", descriptionX, tableTop)
    .text("Amount", amountX, tableTop);

  const generateTableRow = (y, item) => {
    doc
      .fontSize(10)
      .text(item.id, itemCodeX, y)
      .text(item.description, descriptionX, y)
      .text(`$${(item.amount / 100).toFixed(2)}`, amountX, y);
  };

  let y = tableTop + 25;
  invoice.lines.data.forEach((item, index) => {
    generateTableRow(y, item);
    y += 25;
  });

  // Summary
  doc
    .fontSize(10)
    .text(`Subtotal: $${(invoice.subtotal / 100).toFixed(2)}`, amountX, y + 25)
    .text(`Tax: $${(invoice.tax / 100).toFixed(2)}`, amountX, y + 40)
    .text(`Total: $${(invoice.total / 100).toFixed(2)}`, amountX, y + 55)
    .moveDown();

  // Footer
  doc.text("Thank you for your business!", 50, y + 100, {
    align: "center",
    width: 500,
  });

  // Finalize the PDF
  doc.end();

  // Generate the URL to the PDF
  const docUrl = `https://www.blindcircle.com:444/neo/uploads/documents/${mediaFilename}`;

  return docUrl;
};

//This could be for the creator
export async function listCustomerInvoices(user, lastInvoiceId = null) {
  try {
    let key =
      process.env.Environment === "Sandbox"
        ? process.env.STRIPE_SK_TEST
        : process.env.STRIPE_SK_PRODUCTION;
    ////console.log("Key is ", key)
    const stripe = StripeSdk(key);

    let customers = await findCustomer(user);
    let customer = null;
    if (customers && customers.data.length > 0) {
      customer = customers.data[0];
    }
    if (customer == null) {
      return null;
    }

    if (lastInvoiceId == null) {
      const response = await stripe.invoices.list({
        customer: customer.id,
        limit: 20, // Adjust the limit as needed
      });
      let invoices = response.data;
      return invoices;
    }
    const response = await stripe.invoices.list({
      customer: customer.id,
      limit: 20, // Adjust the limit as needed
      starting_after: lastInvoiceId,
    });

    let invoices = response.data;
    //console.log('All invoices:', invoices);
    return invoices;
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return null;
  }
}

///This is for Caller
export async function listCustomerPaymentInvoices(user, lastInvoiceId = null) {
  try {
    let key =
      process.env.Environment === "Sandbox"
        ? process.env.STRIPE_SK_TEST
        : process.env.STRIPE_SK_PRODUCTION;
    ////console.log("Key is ", key)
    const stripe = StripeSdk(key);

    let customers = await findCustomer(user);
    let customer = null;
    if (customers && customers.data.length > 0) {
      customer = customers.data[0];
    }
    if (customer == null) {
      return null;
    }

    // Fetch payment intents
    let paymentIntents = [];
    if (lastInvoiceId == null) {
      const paymentIntentResponse = await stripe.paymentIntents.list({
        customer: customer.id,
        limit: 50,
      });
      paymentIntents = paymentIntentResponse.data;
    } else {
      const paymentIntentResponse = await stripe.paymentIntents.list({
        customer: customer.id,
        limit: 50,
        starting_after: lastInvoiceId,
      });
      paymentIntents = paymentIntentResponse.data;
    }
    //console.log('All invoices:', paymentIntents);
    return paymentIntents;
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return null;
  }
}

//Products
export async function createProductAndPaymentLink(
  userId,
  name,
  description,
  productPrice,
  imageUrl = ""
) {
  try {
    // Step 1: Connect Stripe
    let key =
      process.env.Environment === "Sandbox"
        ? process.env.STRIPE_SK_TEST
        : process.env.STRIPE_SK_PRODUCTION;
    ////console.log("Key is ", key)
    const stripe = StripeSdk(key);

    // Step 2: Create a Product with the unique ID in metadata
    const product = await stripe.products.create({
      name: name,
      description: description,
      images: [imageUrl], // Optional: Replace with your image URL
      metadata: { userId: userId }, // Store the unique ID in metadata
    });

    //console.log("Product created with User ID:", userId);

    // Step 3: Create a Price for the Product
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: productPrice * 100, // Price in cents (e.g., 2000 cents = $20.00)
      currency: "usd",
    });

    //console.log("Price created:", price.id);

    // Step 4: Create a Payment Link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
    });

    //console.log("Payment Link created:", paymentLink.url);

    return {
      paymentLink: paymentLink.url,
      productId: product.id,
      priceId: price.id,
    };
  } catch (error) {
    console.error("Error creating product and payment link:", error);
    return null;
  }
}
