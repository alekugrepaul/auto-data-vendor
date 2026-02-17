// ================== IMPORT PACKAGES ==================
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ================== ENV VARIABLES ==================
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const BYTEWAVE_API_KEY = process.env.BYTEWAVE_API_KEY;

// ================== BUYING PRICES ==================

// MTN
const MTN_PRICES = [4.5,9,13,17,21,25.8,34,41.5,59.5,79,97.25,118,156,193];

// TELECEL
const TELECEL_PRICES = [39,58,76,110,146,182];

// AT
const AT_PRICES = [4.3,8.4,12,16,19.25,24,27.5,31.5,39];

// ================== TRANSACTION STORAGE ==================
let transactions = [];

// ================== HOME ROUTE ==================
app.get('/', (req, res) => {
  res.send('Auto Data Vendor server is running ✅');
});

// ================== ADMIN DASHBOARD ==================
app.get('/admin', (req, res) => {

  let totalProfit = transactions.reduce((sum, t) => sum + t.profit, 0);

  res.send(`
    <h1>DATA VENDOR ADMIN PANEL</h1>
    <h2>Total Transactions: ${transactions.length}</h2>
    <h2>Total Profit: GHS ${totalProfit.toFixed(2)}</h2>

    <table border="1" cellpadding="10">
      <tr>
        <th>Phone</th>
        <th>Network</th>
        <th>Paid</th>
        <th>Buying Price</th>
        <th>Profit</th>
        <th>Status</th>
      </tr>

      ${transactions.map(t => `
        <tr>
          <td>${t.phone}</td>
          <td>${t.network}</td>
          <td>${t.paid}</td>
          <td>${t.buy}</td>
          <td>${t.profit}</td>
          <td>${t.status}</td>
        </tr>
      `).join("")}

    </table>
  `);
});

// ================== PAYSTACK WEBHOOK ==================
app.post('/paystack-webhook', async (req, res) => {
  try {

    const event = req.body;
    const reference = event.data.reference;
    const phone = event.data.customer.phone;
    const amountPaid = event.data.amount / 100;

    console.log(`Payment received: ${reference} | ${phone} | ${amountPaid}`);

    // VERIFY PAYMENT
    const verifyRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );

    if (verifyRes.data.data.status !== 'success') {
      console.log('Payment verification failed');
      return res.status(400).send('Payment not verified');
    }

    console.log('Payment verified successfully');

    // ================= DETERMINE NETWORK =================
    let network = "MTN"; // default
    if (phone.startsWith("020") || phone.startsWith("050")) network = "TELECEL";
    if (phone.startsWith("027") || phone.startsWith("057")) network = "AT";

    // ================= MATCH BUYING PRICE =================
    let buyingPrice = 0;

    if (network === "MTN") {
      buyingPrice = MTN_PRICES.find(p => p <= amountPaid);
    }

    if (network === "TELECEL") {
      buyingPrice = TELECEL_PRICES.find(p => p <= amountPaid);
    }

    if (network === "AT") {
      buyingPrice = AT_PRICES.find(p => p <= amountPaid);
    }

    if (!buyingPrice) {
      console.log("No matching bundle price");
      return res.status(400).send("Bundle not matched");
    }

    // ================= PROFIT =================
    const profit = amountPaid - buyingPrice;

    // ================= SEND ORDER TO BYTEWAVE =================
    const bytewaveRes = await axios.post(
      "https://api.bytewave.com/order",
      {
        phone: phone,
        amount: buyingPrice
      },
      {
        headers: {
          Authorization: `Bearer ${BYTEWAVE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("Bytewave success:", bytewaveRes.data);

    // ================= SAVE SUCCESS TRANSACTION =================
    transactions.push({
      phone: phone,
      network: network,
      paid: amountPaid,
      buy: buyingPrice,
      profit: profit,
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

// ================== START SERVER ==================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
