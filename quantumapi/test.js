const express = require('express');
const app = express();

app.get('/test', (req, res) => {
  res.send('Everything works now');
});

app.listen(3001, () =>
   console.log('Test server running on 3001'));