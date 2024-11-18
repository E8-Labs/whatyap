import StripeSdk from "stripe";
import axios from "axios";
import qs from "qs";
import db from "../models/index.js";

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
// import logo from '../assets/applogo.png'

const AppSuffix = "";
const AppPrefix = "Whaty_";

export const getStripe = async (whoami = "Create Stripe instance") => {
  let key =
    process.env.Environment === "Sandbox"
      ? process.env.STRIPE_SK_TEST
      : process.env.STRIPE_SK_PRODUCTION;
  // //console.log("Key is create customer ", key)
  //console.log("whoami", whoami);

  try {
    const stripe = StripeSdk(key);
    return stripe;
  } catch (error) {
    //console.log("Error createing stripe")
    return null;
  }
};

export const createCustomer = async (user, whoami = "default") => {
  let key =
    process.env.Environment === "Sandbox"
      ? process.env.STRIPE_SK_TEST
      : process.env.STRIPE_SK_PRODUCTION;
  // //console.log("Key is create customer ", key)
  //console.log("whoami", whoami);

  try {
    const stripe = StripeSdk(key);
    let alreadyCustomer = await findCustomer(user);
    //console.log("Customer is ", alreadyCustomer)
    let u = await db.User.findByPk(user.id);
    if (alreadyCustomer && alreadyCustomer.data.length >= 1) {
      //console.log("Already found ");
      u.customerId = alreadyCustomer.data[0].id;
      let updated = await u.save();
      //console.log("Returning Already customer");
      return alreadyCustomer.data[0];
    } else {
      const customer = await stripe.customers.create({
        name: user.name,
        email: AppPrefix + user.email,
        metadata: {
          id: AppPrefix + user.id,
          //   dob: user.dob || "",
          image: user.profile_image || "",
          //   points: user.points,
        },
      });

      //console.log("Customer New ");
      u.customerId = customer.id;
      await u.save();
      return customer;
    }

    // return customer
  } catch (error) {
    //console.log(error);
    return null;
  }
};

export const findCustomer = async (user) => {
  let key =
    process.env.Environment === "Sandbox"
      ? process.env.STRIPE_SK_TEST
      : process.env.STRIPE_SK_PRODUCTION;
  //console.log("Key is find cust", key);

  try {
    const stripe = StripeSdk(key);
    const customer = await stripe.customers.search({
      query: `email: '${AppPrefix}${user.email}'`,
    });

    // const customer = await stripe.customers.search({
    //   query: `metadata['id']:'${AppPrefix}${user.id}${AppSuffix}'`,
    // });

    return customer;
  } catch (error) {
    //console.log(error);
    return null;
  }
};

//Tags: AddCard, AddPaymentSource
//
export const createCard = async (user, token) => {
  let key =
    process.env.Environment === "Sandbox"
      ? process.env.STRIPE_SK_TEST
      : process.env.STRIPE_SK_PRODUCTION;
  console.log("Using key ", key);
  try {
    const stripe = StripeSdk(key);
    let customer = await createCustomer(user, "createcard");

    // Create a Payment Method using the token
    let paymentMethod;
    try {
      paymentMethod = await stripe.paymentMethods.create({
        type: "card",
        card: { token },
      });
      //console.log("Added new payment method", paymentMethod)
    } catch (createError) {
      //console.log("Error creating Payment Method, trying to retrieve existing one");
      paymentMethod = await stripe.paymentMethods.retrieve(token); // Retrieve using the existing PaymentMethod ID
      //console.log("Retrieved existing Payment Method:", paymentMethod);
    }

    if (paymentMethod.customer !== customer.id) {
      //console.log("Attaching Payment Method to customer");
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: customer.id,
      });
    }

    // Check if the Payment Method is chargeable
    // //console.log(paymentMethod)
    // Check the CVC and address checks
    // const { cvc_check, address_postal_code_check } = paymentMethod.card.checks;
    // if (cvc_check !== 'pass' || address_postal_code_check !== 'pass') {
    //   //console.log("Card verification failed. CVC or postal code check did not pass.");
    //   throw new Error("Card verification failed. Please check your card details.");
    // }

    // Authorize a small amount (like $1) to check for available funds
    const charge = await stripe.paymentIntents.create({
      amount: 100, // $1.00 in cents
      currency: "usd",
      payment_method: paymentMethod.id,
      customer: customer.id,
      capture_method: "manual", // Authorize only, do not capture
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: "never", // Prevents redirect for authentication
      },
    });

    // Check if the charge was successful
    if (charge.status !== "requires_capture") {
      //console.log("Card does not have sufficient funds or is not valid.");
      throw new Error("The card does not have sufficient funds.");
    }

    // If the charge was successful, reverse the authorization
    await stripe.paymentIntents.cancel(charge.id);
    //console.log("Authorization reversed successfully.");

    // Attach the Payment Method to the Customer
    const customerSource = await stripe.paymentMethods.attach(
      paymentMethod.id,
      {
        customer: customer.id,
      }
    );

    // Set this card as the default payment method if none exists
    const defaultPaymentMethodId =
      customer.invoice_settings.default_payment_method;
    if (defaultPaymentMethodId == null) {
      //console.log("Saving default payment method", customerSource);
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: customerSource.id,
        },
      });
    }

    return customerSource.card;
  } catch (error) {
    //console.log("Card error");
    //console.log(error);
    return { error: error.message };
  }
};

export const deleteCard = async (user, cardId) => {
  let key =
    process.env.Environment === "Sandbox"
      ? process.env.STRIPE_SK_TEST
      : process.env.STRIPE_SK_PRODUCTION;

  try {
    const stripe = StripeSdk(key);
    let customer = await createCustomer(user, "deleteCard");

    if (!customer || !customer.id) {
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

export const loadCards = async (user) => {
  // Determine the API key based on the environment
  let key =
    process.env.Environment === "Sandbox"
      ? process.env.STRIPE_SK_TEST
      : process.env.STRIPE_SK_PRODUCTION;

  const stripe = StripeSdk(key);

  try {
    // Find the customer object associated with the user
    let customers = await findCustomer(user);
    let customer = null;
    if (customers && customers.data.length > 0) {
      customer = customers.data[0];
    }

    //console.log("Customer in load card is ", customer);

    if (!customer || !customer.id) {
      console.error("No customer found for user.");
      return null;
    }

    // Use the Stripe SDK directly to fetch the payment methods (cards)
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customer.id,
      type: "card", // Filter by card type
      limit: 10, // Optional limit parameter
    });

    // Check if the response has any data
    if (paymentMethods && paymentMethods.data) {
      //console.log("Cards loaded successfully:", paymentMethods.data);
      return paymentMethods.data;
    } else {
      console.error("No cards found for this customer.");
      return null;
    }
  } catch (error) {
    console.error("Error loading cards:", error);
    return null;
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
  amountInCents,
  user,
  title = "",
  description = ""
) {
  let key =
    process.env.Environment === "Sandbox"
      ? process.env.STRIPE_SK_TEST
      : process.env.STRIPE_SK_PRODUCTION;
  try {
    const stripe = StripeSdk(key);
    let customer = await createCustomer(user, "cancelsub");
    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amountInCents),
      currency: "usd",
      customer: customer.id,
      payment_method_types: ["card"],
      confirm: true,
      description: description,
      metadata: {
        product_name: title,
        product_description: description,
      },
      off_session: true,
    });

    // //console.log("Payment intent ", paymentIntent);

    if (paymentIntent.status === "succeeded") {
      return {
        status: true,
        message: "Charge was successful.",
        reason: "succeeded",
        payment: paymentIntent,
      };
    } else {
      return {
        status: false,
        message: `Charge was not successful. Status: ${paymentIntent.status}`,
        reason: paymentIntent.status,
        payment: paymentIntent,
      };
    }
  } catch (error) {
    // Handle errors
    //console.log("Error Charging ", error);
    return {
      status: false,
      message: `Charge failed: ${error.message}`,
      reason: error.type || "unknown_error",
      payment: null,
    };
  }
}

// export const deleteCard = async (user, token) => {

//     let key = process.env.Environment === "Sandbox" ? process.env.STRIPE_SK_TEST : process.env.STRIPE_SK_PRODUCTION;
//     ////console.log("Key is ", key)
//     const stripe = StripeSdk(key);

//     try {
//         let customer = await createCustomer(user);

//         const customerSource = await stripe.customers.deleteSource(
//             customer.id,
//             {
//                 source: token,
//             }
//         );

//         return customerSource
//     }
//     catch (error) {
//         ////console.log(error)
//         return null
//     }
// }

// export const loadCards = async (user) => {
//   let key =
//     process.env.Environment === "Sandbox"
//       ? process.env.STRIPE_SK_TEST
//       : process.env.STRIPE_SK_PRODUCTION;
//   ////console.log("Key is ", key)
//   const stripe = StripeSdk(key);

//   try {
//     let customers = await findCustomer(user);
//     let customer = null;
//     if (customers && customers.data.length > 0) {
//       customer = customers.data[0];
//     }
//     //console.log("Customer in load card is ", customer);

//     let data = qs.stringify({
//       limit: "10",
//     });

//     let config = {
//       method: "get",
//       maxBodyLength: Infinity,
//       url: `https://api.stripe.com/v1/customers/${customer.id}/cards?limit=10`,
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded",
//         Authorization: `Bearer ${key}`,
//       },
//       data: data,
//     };

//     let response = await axios.request(config);
//     if (response) {
//       ////console.log("Load cards request");
//       ////console.log(JSON.stringify(response.data.data));
//       return response.data.data;
//     } else {
//       ////console.log("Load cards request errored");
//       ////console.log(error);
//       return null;
//     }
//   } catch (error) {
//     ////console.log("Load cards request errored out");
//     ////console.log(error)
//     return null;
//   }
// };

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
