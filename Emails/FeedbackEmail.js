export function generateFeedbackToAdminEmail(
  userName,
  userEmail,
  userPhone = "",
  feedbackMessage
) {
  return `
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              padding: 20px;
              color: #333;
            }
            .container {
              max-width: 600px;
              margin: auto;
              background: #ffffff;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            }
            h2 {
              color: #D44740;
            }
            .section {
              margin-bottom: 20px;
            }
            .label {
              font-weight: bold;
              color: #555;
            }
            .footer {
              font-size: 12px;
              color: #888;
              text-align: center;
              margin-top: 40px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>📝 New Feedback Received</h2>
  
            <div class="section">
              <div class="label">Name:</div>
              <div>${userName || "N/A"}</div>
            </div>
  
            <div class="section">
              <div class="label">Email:</div>
              <div>${userEmail || "N/A"}</div>
            </div>
  
            <div class="section">
              <div class="label">Phone:</div>
              <div>${userPhone || "N/A"}</div>
            </div>
  
            <div class="section">
              <div class="label">Feedback Message:</div>
              <div style="white-space: pre-wrap;">${
                feedbackMessage || "N/A"
              }</div>
            </div>
  
            <div class="footer">
              Feedback submitted via WhatYap Feedback Form.
            </div>
          </div>
        </body>
      </html>
    `;
}
