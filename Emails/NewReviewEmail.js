export function generateWhatYapReviewEmail(
  customerName,
  businessName,
  reviewLink = ""
) {
  console.log("Generating template for ", customerName);
  console.log("Business ", businessName);
  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>You've Been Reviewed!</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f7f7f7;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 30px;
            max-width: 600px;
            margin: auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            color: #7902DF;
          }
          p {
            font-size: 16px;
            line-height: 1.5;
          }
          .button {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background-color: #7902DF;
            color: #fff;
            text-decoration: none;
            font-weight: bold;
            border-radius: 5px;
          }
          .footer {
            margin-top: 30px;
            font-size: 14px;
            color: #777;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎉 You've Been Reviewed on WhatYap by ${businessName}!</h1>
          <p>Hi ${customerName},</p>
          <p>Big news! 🎊 You’ve just been added and reviewed on <strong>WhatYap</strong> by <strong>${businessName}</strong> — and we think you're going to love what they had to say.</p>
          <p>Whether it’s recognition for your loyalty, amazing service, or just a shoutout for being awesome — this review is all about <strong>you</strong>. 👏</p>
          <p style="margin-top: 20px;">Make an account with this email address to see you're review.</p>
          <p style="margin-top: 20px;">We built WhatYap to celebrate real people and real stories. Go see what’s been said about you</p>
          <div class="footer">
            <p>Talk soon,<br />The WhatYap Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
}
