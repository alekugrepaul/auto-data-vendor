// server.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Environment variables
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const BYTEWAVE_API_KEY = process.env.BYTEWAVE_API_KEY;

// ===== Homepage Route =====
app.get('/', (req, res) => {
  res.send('Auto Data Vendor server is running ✅');
});

// ===== Paystack Webhook Route =====
app.post('/paystack-webhook', async (req, res) => {
  try {
    const event = req.body;

    // Verify the webhook signature (optional but recommended)
    const reference = event.data.reference;
    const customerPhone = event.data.customer.phone;
    const amountPaid = event.data.amount / 100; // convert to Ghana cedis if in kobo

    console.log(`Webhook received for reference: ${reference}, phone: ${customerPhone}, amount: ${amountPaid}`);

    // 1️⃣ Verify payment with Paystack
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    if (verifyRes.data.data.status !== 'success') {
      console.log('Payment verification failed');
      return res.status(400).send('Payment not verified');
    }

    console.log('Payment verified successfully ✅');

    // 2️⃣ Determine bundle to buy based on amountPaid
    // You can customize this mapping based on your MTN/Telecel/AT packages
    // Example: 
    // 4.8 → "1GB MTN"
    // 9.6 → "2GB MTN"
    let bundlePackage = ''; // set dynamically

    // For demonstration, just sending a generic package
    bundlePackage = `Bundle corresponding to ${amountPaid} GHS`;

    // 3️⃣ Send request to Bytewave API
    const bytewaveRes = await axios.post(
      'https://api.bytewave.com/order', // replace with your actual Bytewave endpoint
      {
        phone: customerPhone,
        package: bundlePackage
      },
      {
        headers: {
          'Authorization': `Bearer ${BYTEWAVE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Bytewave response:', bytewaveRes.data);

    // 4️⃣ Respond to Paystack
    res.status(200).send('Webhook received and processed');

  } catch (error) {
    console.error('Error processing webhook:', error.message);
    res.status(500).send('Internal server error');
  }
});

// ===== Start Server =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
