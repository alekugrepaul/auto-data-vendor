const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ===============================
// NETWORK DETECTION
// ===============================
function detectNetwork(phone) {

  const local = phone.startsWith('+233')
    ? phone.replace('+233', '0')
    : phone;

  if (
    local.startsWith('059') ||
    local.startsWith('053') ||
    local.startsWith('054') ||
    local.startsWith('055') ||
    local.startsWith('024') ||
    local.startsWith('025')
  ) {
    return 'MTN';
  }

  if (local.startsWith('020') || local.startsWith('050')) {
    return 'TELECEL';
  }

  if (
    local.startsWith('026') ||
    local.startsWith('056') ||
    local.startsWith('027') ||
    local.startsWith('057')
  ) {
    return 'AT';
  }

  return null;
}

// ===============================
// PAYSTACK WEBHOOK
// ===============================
app.post('/webhook', async (req, res) => {

  try {

    const event = req.body;

    // Only process successful payments
    if (event.event !== 'charge.success') {
      return res.sendStatus(200);
    }

    const amount = event.data.amount / 100; // convert kobo to GHS
    const phone = event.data.metadata?.phone;

    console.log('Payment received:', amount, phone);

    if (!phone) {
      console.log('Phone missing in metadata');
      return res.sendStatus(200);
    }

    const network = detectNetwork(phone);

    if (!network) {
      console.log('Unsupported network:', phone);
      return res.sendStatus(200);
    }

    const formattedPhone = phone.startsWith('+233')
      ? phone.replace('+233', '0')
      : phone;

    const orderReference = "ORD" + Date.now(); // Unique order ID

    const capacityInGb = 1; // Example: 1GB bundle

    console.log('Detected network:', network);
    console.log('Buying bundle:', capacityInGb + 'GB');

    // ===============================
    // BYTEWAVE PURCHASE (FIXED FORMAT)
    // ===============================
    const bytewaveResponse = await axios.post(
      'https://api.bytewavegh.com/api/v1/data/purchase', // Use LIVE endpoint if provided
      {
        networkReference: network,          // MTN / TELECEL / AT
        orderReference: orderReference,     // Required
        recipientPhone: formattedPhone,     // Required
        capacityInGb: capacityInGb          // Must be NUMBER
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.BYTEWAVE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('BYTEWAVE SUCCESS:', bytewaveResponse.data);

    res.sendStatus(200);

  } catch (error) {

    if (error.response) {
      console.log('BYTEWAVE ERROR:', error.response.data);
    } else {
      console.log('SERVER ERROR:', error.message);
    }

    res.sendStatus(500);
  }

});

// ===============================
app.get('/', (req, res) => {
  res.send('Server Running...');
});

// ===============================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
