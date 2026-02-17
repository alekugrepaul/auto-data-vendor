// ================== server.js ==================
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ========== ENV VARIABLES ==========
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const BYTEWAVE_API_KEY = process.env.BYTEWAVE_API_KEY;

// ========== TRANSACTIONS STORAGE ==========
let transactions = [];

// ====== PRICE LISTS ======
const MTN_PRICES = [4.5, 9, 13, 17, 21, 25.8, 34, 41.5, 59.5, 79, 97.25, 118, 156, 193];
const TELECEL_PRICES = [39, 58, 76, 110, 146, 182];
const AT_PRICES = [4.3, 8.4, 12, 16, 19.25, 24, 27.5, 31.5, 39];

const packagesMTN = {
  4.5: "1GB MTN", 9: "2GB MTN", 13: "3GB MTN", 17: "4GB MTN", 21: "5GB MTN",
  25.8: "6GB MTN", 34: "7GB MTN", 41.5: "8GB MTN", 59.5: "10GB MTN", 79: "15GB MTN",
  97.25: "20GB MTN", 118: "25GB MTN", 156: "30GB MTN", 193: "40GB MTN"
};

const packagesTelecel = {
  39: "1GB TELECEL", 58: "2GB TELECEL", 76: "3GB TELECEL", 110: "5GB TELECEL",
  146: "8GB TELECEL", 182: "10GB TELECEL"
};

const packagesAT = {
  4.3: "1GB AT", 8.4: "2GB AT", 12: "3GB AT", 16: "4GB AT", 19.25: "5GB AT",
  24: "6GB AT", 27.5: "7GB AT", 31.5: "8GB AT", 39: "10GB AT"
};

// ====== HOMEPAGE ======
app.get('/', (req, res) => {
  res.send('Auto Data Vendor server is running ✅');
});

// ====== ADMIN PANEL ======
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

// ====== PAYSTACK WEBHOOK ======
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
    let network = "MTN"; // default
    if (phone.startsWith("020") || phone.startsWith("050")) network = "TELECEL";
    if (phone.startsWith("027") || phone.startsWith("057")) network = "AT";

    // MAP AMOUNT TO PACKAGE
    let buyingPrice = 0;
    let bundlePackage = "";

    if (network === "MTN") {
      buyingPrice = MTN_PRICES.find(p => p <= amountPaid);
      bundlePackage = packagesMTN[buyingPrice];
    } else if (network === "TELECEL") {
      buyingPrice = TELECEL_PRICES.find(p => p <= amountPaid);
      bundlePackage = packagesTelecel[buyingPrice];
    } else if (network === "AT") {
      buyingPrice = AT_PRICES.find(p => p <= amountPaid);
      bundlePackage = packagesAT[buyingPrice];
    }

    if (!bundlePackage) {
      console.log("No matching package found for this amount");
      transactions.push({
        phone: phone,
        network: network,
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
      "https://api.bytewave.com/order", // ← Replace with your actual Bytewave URL
      { phone: phone, package: bundlePackage },
      {
        headers: {
          Authorization: `Bearer ${BYTEWAVE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("Bytewave response:", bytewaveRes.data);

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

// ====== START SERVER ======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
