const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

// === CONFIGURATION ===
const BYTEWAVE_API_KEY = "YOUR_BYTEWAVE_API_KEY"; // replace this with your real key
const BYTEWAVE_ENDPOINT = "https://agent.bytewavegh.com/api/data"; // from API docs
const ADMIN_EMAIL = "your-email@gmail.com"; // your alert email
// =====================

// Paystack webhook endpoint
app.post('/paystack-webhook', async (req, res) => {
  const event = req.body;

  // Verify payment
  if(event.event === "charge.success") {
    const data = event.data;
    const customerPhone = data.customer.phone; // ensure this is correct from Paystack payload
    const network = data.metadata.network; // we will send network as metadata
    const bundle = data.metadata.bundle;   // bundle name as metadata

    try {
      // Send order to Bytewave
      const response = await axios.post(BYTEWAVE_ENDPOINT, {
        network: network,
        phone: customerPhone,
        plan: bundle,
        api_key: BYTEWAVE_API_KEY
      });

      console.log("Bytewave response:", response.data);

      // Send admin alert (simple console log for now, email can be added later)
      console.log(`NEW ORDER: ${network} ${bundle} sent to ${customerPhone}`);
      
      res.status(200).send("Success");
    } catch(err) {
      console.error("Bytewave error:", err.response?.data || err.message);
      res.status(500).send("Bytewave error");
    }
  } else {
    res.status(200).send("Event ignored");
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
