const express = require('express');
const axios = require('axios');
const cors = require('cors');
const https = require('https');

const app = express();
app.use(cors());
app.use(express.json());

// ENV VARIABLES
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const BYTEWAVE_API_KEY = process.env.BYTEWAVE_API_KEY;

// ADMIN PASSWORD
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Paul5378,.';

// TEST ROUTE
app.get('/', (req, res) => {
  res.send('Auto Data Vendor server running...');
});

// ADMIN PANEL ROUTE
app.get('/admin', (req, res) => {
  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).send('Unauthorized');
  }
  res.send('Welcome to Admin Panel');
});

// PAYSTACK WEBHOOK
app.post('/paystack-webhook', async (req, res) => {
  try {
    const event = req.body;

    // Only process successful payments
    if (event.event !== 'charge.success') {
      return res.sendStatus(200);
    }

    const reference = event.data.reference;
    let phone = event.data.customer.phone || event.data.customer.mobile || "";
    const amountPaid = event.data.amount / 100;

    console.log("Payment received:", amountPaid, phone);

    // VERIFY PAYMENT FROM PAYSTACK
    const verify = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    );

    if (!verify.data || verify.data.data.status !== "success") {
      console.log("Payment not verified");
      return res.sendStatus(400);
    }

    console.log("Payment verified");

    // FORMAT PHONE TO 233xxxxxxxxx
    if (phone.startsWith("0")) {
      phone = "233" + phone.substring(1);
    }
    if (phone.startsWith("+233")) {
      phone = phone.replace("+", "");
    }

    // DETECT NETWORK
    let network = "mtn";

    if (phone.startsWith("23320") || phone.startsWith("23350")) network = "telecel";
    if (phone.startsWith("23324") || phone.startsWith("23354") || phone.startsWith("23355")) network = "at";

    // MAP AMOUNT → BUNDLE SIZE
    let capacity = 1;

    if (amountPaid == 4.8) capacity = 1;
    if (amountPaid == 9.6) capacity = 2;
    if (amountPaid == 14.4) capacity = 3;
    if (amountPaid == 19.2) capacity = 4;
    if (amountPaid == 24) capacity = 5;
    if (amountPaid == 28.8) capacity = 6;
    if (amountPaid == 38.4) capacity = 8;
    if (amountPaid == 48) capacity = 10;

    console.log("Buying bundle:", network, capacity, "GB");

    // CALL BYTEWAVE API (SSL FIX INCLUDED)
    const bytewave = await axios.post(
      'https://api.bytewave.com/v1/purchaseBundle',
      {
        network: network,
        reference: reference,
        msisdn: phone,
        capacity: capacity
      },
      {
        headers: {
          Authorization: `Bearer ${BYTEWAVE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      }
    );

    console.log("Bytewave response:", bytewave.data);

    res.sendStatus(200);

  } catch (err) {
    console.log("BYTEWAVE ERROR:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// IMPORTANT FOR RENDER PORT
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
