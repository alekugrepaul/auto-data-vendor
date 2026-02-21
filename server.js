const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ================= ENV VARIABLES =================
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const BYTEWAVE_API_KEY = process.env.BYTEWAVE_API_KEY;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Paul5378,.';

// ================= TEST ROUTE =================
app.get('/', (req, res) => {
  res.send('Auto Data Vendor server running...');
});

// ================= ADMIN PANEL =================
app.get('/admin', (req, res) => {
  const auth = req.headers['authorization'];

  if (!auth || auth !== `Bearer ${ADMIN_PASSWORD}`) {
    return res.status(401).send('Unauthorized');
  }

  res.send('Welcome to Admin Panel');
});

// ================= PAYSTACK WEBHOOK =================
app.post('/paystack-webhook', async (req, res) => {
  try {
    const event = req.body;

    if (event.event !== 'charge.success') {
      return res.sendStatus(200);
    }

    const reference = event.data.reference;
    let phone = event.data.customer.phone || "";
    const amountPaid = event.data.amount / 100;

    console.log("Payment received:", amountPaid, phone);

    // ================= VERIFY PAYMENT =================
    const verify = await axios.get(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`
        }
      }
    );

    if (verify.data.data.status !== "success") {
      console.log("Payment not verified");
      return res.sendStatus(400);
    }

    console.log("Payment verified");

    // ================= FORMAT PHONE =================
    if (phone.startsWith("0")) {
      phone = "233" + phone.substring(1);
    }

    if (phone.startsWith("+")) {
      phone = phone.replace("+", "");
    }

    // ================= DETECT NETWORK =================
    let network = "mtn";

    // FORCE MTN prefixes
    if (
      phone.startsWith("23359") ||
      phone.startsWith("23353") ||
      phone.startsWith("23324") ||
      phone.startsWith("23354") ||
      phone.startsWith("23355") ||
      phone.startsWith("23325")
    ) {
      network = "mtn";
    }

    // TELECEL prefixes
    if (phone.startsWith("23320") || phone.startsWith("23350")) {
      network = "telecel";
    }

    // AIRTELTIGO prefixes
    if (phone.startsWith("23327") || phone.startsWith("23357")) {
      network = "at";
    }

    console.log("Detected network:", network);

    // ================= MAP AMOUNT TO BUNDLE SIZE =================
    const bundleMap = {
      4.8: 1,
      9.6: 2,
      14.4: 3,
      19.2: 4,
      24: 5,
      28.8: 6,
      38.4: 8,
      48: 10
    };

    const capacity = bundleMap[amountPaid];

    if (!capacity) {
      console.log("Amount not mapped to bundle:", amountPaid);
      return res.sendStatus(400);
    }

    console.log("Buying bundle:", network, capacity, "GB");

    // ================= BYTEWAVE API CALL =================
    const bytewave = await axios.post(
     /v1/purchaseBundle,
      {
        network: network,
        reference: reference,
        msisdn: phone,
        capacity: capacity
      },
      {
        headers: {
          Authorization: `Bearer ${BYTEWAVE_API_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0'
        }
      }
    );

    console.log("Bytewave response:", bytewave.data);

    res.sendStatus(200);

  } catch (err) {
    console.log("BYTEWAVE ERROR:", err.response?.data || err.message);
    res.sendStatus(500);
  }
});

// ================= START SERVER =================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
