require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ===============================
// NETWORK DETECTION
// ===============================
function detectNetwork(phone) {

  const local = phone.replace('+233', '0');

  if (
    local.startsWith('059') ||
    local.startsWith('053') ||
    local.startsWith('054') ||
    local.startsWith('055') ||
    local.startsWith('024') ||
    local.startsWith('025')
  ) {
    return 'mtn';
  }

  if (local.startsWith('020') || local.startsWith('050')) {
    return 'telecel';
  }

  if (local.startsWith('026') || local.startsWith('056')) {
    return 'at';
  }

  return null;
}

// ===============================
// WEBHOOK (PAYMENT RECEIVED)
// ===============================
app.post('/webhook', async (req, res) => {

  try {

    const { amount, phone } = req.body;

    console.log('Payment received:', amount, phone);

    if (!amount || !phone) {
      return res.status(400).json({ error: 'Missing data' });
    }

    console.log('Payment verified');

    const network = detectNetwork(phone);

    if (!network) {
      console.log('Unknown network');
      return res.status(400).json({ error: 'Unsupported network' });
    }

    console.log('Detected network:', network);

    // Example: ₵4.8 = 1GB
    let capacity = 1;

    const reference = Date.now().toString();

    const formattedPhone = phone.startsWith('+233')
      ? phone.replace('+233', '0')
      : phone;

    console.log('Buying bundle:', network, capacity + 'GB');

    // ===============================
    // BYTEWAVE PURCHASE
    // ===============================
    const bytewaveResponse = await axios.post(
      'https://dev.bytewavegh.com/api/v1/purchaseBundle',
      {
        network: network,
        reference: reference,
        msisdn: formattedPhone,
        capacity: capacity
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.BYTEWAVE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('BYTEWAVE SUCCESS:', bytewaveResponse.data);

    res.status(200).json({ success: true });

  } catch (error) {

    if (error.response) {
      console.log('BYTEWAVE ERROR:', error.response.data);
    } else {
      console.log('SERVER ERROR:', error.message);
    }

    res.status(500).json({ error: 'Transaction failed' });
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
