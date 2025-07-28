const express = require('express');
const router = express.Router();

router.post('/api/pxl/webhook', (req, res) => {
  const payload = req.body;
  console.log('📩 Received webhook from PXL:', payload);

  // Optional: Verify secret if PXL sends one
  // if (req.headers['x-pxl-secret'] !== process.env.PXL_WEBHOOK_SECRET) {
  //   return res.status(401).json({ error: 'Unauthorized' });
  // }

  // TODO: Save to DB, trigger email, etc.

  res.status(200).json({ message: 'Webhook received' });
});

module.exports = router; 