// ================== server.js ==================
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== ENV VARIABLES =====
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const BYTEWAVE_API_KEY = process.env.BYTEWAVE_API_KEY;
const BYTEWAVE_BASE_URL = "https://api.bytewavegh.com"; // ← Bytewave domain from Postman

// ===== TRANSACTIONS STORAGE =====
let transactions = [];

// ===== PRICE LISTS =====
const MTN_PRICES = [4.5, 9, 13, 17, 21, 25.8, 34, 41.5, 59.5, 79, 97.25, 118, 156, 193];
const TELECEL_PRICES = [39, 58, 76, 110, 146, 182];
const AT_PRICES = [4.3, 8.4, 12, 16, 19.25, 24, 27.5, 31.5, 39];

const packagesMTN = { 4.5:1,9:2,13:3,17:4,21:5,25.8:6,34:7,41.5:8,59.5:10,79:15,97.25:20,118:25,156:30,193:40 };
const packagesTelecel = { 39:1,58:2,76:3,110:5,146:8,182:10 };
const packagesAT = { 4.3:1,8.4:2,12:3,16:4,19.25:5,24:6,27.5:7,31.5:8,39:10 };

// ===== HOMEPAGE =====
app.get('/', (req, res) => {
  res.send('Auto Data Vendor server is running ✅');
});

// ===== ADMIN PANEL =====
app.get('/admin', (req, res) => {
  let html = `<h1>Admin Panel</h1>`;
  html += `<table border="1" cellpadding="10"><tr>
    <th>Phone</th><th>Network</th><th>Paid(GHS)</th><th>Buying Price(GHS)</th><th>Profit(GHS)</th><th>Status</th>
  </tr>`;
  transactions.forEach(t => {
    html += `<tr>
      <td>${t.phone}</td>
      <td>${t.network}</td>
      <td>${t.paid}</td>
      <td>${t.buy}</td>
      <td>${t.profit}</td>
      <td>${t.status}</td>
    </tr>`;
  });
  html += `</table>`;
  res.send(html);
});

// ===== PAYSTACK WEBHOOK =====
app.post('/paystack-webhook', async (req, res) => {
  try {
    const event = req.body;
    const reference = event.data.reference;
    const phone = event.data.customer.phone;
    const amountPaid = event.data.amount / 100; // GHS

    console.log(`Payment received: ${reference} | ${phone} | ${amountPaid} GHS`);

    // VERIFY PAYMENT
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    if (verifyRes.data.data.status !== 'success') {
      console.log('Payment verification failed');
      return res.status(400).send('Payment not verified');
    }

    console.log('Payment verified ✅');

    // DETERMINE NETWORK
    let network = "mtn";
    if (phone.startsWith("020") || phone.startsWith("050")) network = "telecel";
    if (phone.startsWith("027") || phone.startsWith("057")) network = "at";

    // MAP AMOUNT TO PACKAGE
    let buyingPrice = 0;
    let capacity = 0;

    if (network === "mtn") {
      buyingPrice = MTN_PRICES.find(p => p <= amountPaid);
      capacity = packagesMTN[buyingPrice];
    } else if (network === "telecel") {
      buyingPrice = TELECEL_PRICES.find(p => p <= amountPaid);
      capacity = packagesTelecel[buyingPrice];
    } else if (network === "at") {
      buyingPrice = AT_PRICES.find(p => p <= amountPaid);
      capacity = packagesAT[buyingPrice];
    }

    if (!capacity) {
      console.log("No matching package found for this amount");
      transactions.push({
        phone,
        network,
        paid: amountPaid,
        buy: 0,
        profit: 0,
        status: "FAILED - NO PACKAGE MATCH"
      });
      return res.status(400).send("Bundle not matched");
    }

    const profit = amountPaid - buyingPrice;

    // SEND ORDER TO BYTEWAVE
    const bytewaveRes = await axios.post(
      `${BYTEWAVE_BASE_URL}/v1/purchaseBundle`,
      {
        network,
        reference,
        msisdn: phone,
        capacity
      },
      {
        headers: {
          Authorization: `Bearer ${BYTEWAVE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("Bytewave response:", bytewaveRes.data);

    transactions.push({
      phone,
      network,
      paid: amountPaid,
      buy: buyingPrice,
      profit,
      status: "SUCCESS"
    });

    res.status(200).send('Webhook processed');

  } catch (error) {
    console.log("ERROR:", error.message);
    transactions.push({
      phone: "unknown",
      network: "unknown",
      paid: 0,
      buy: 0,
      profit: 0,
      status: "FAILED"
    });
    res.status(500).send('Server error');
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
