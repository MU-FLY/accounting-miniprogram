const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const billsRouter = require('./routes/bills');
app.use('/api/bills', billsRouter);

app.get('/', (req, res) => {
  res.json({ message: 'Accounting API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
