import express from 'express';
import walletRouter from '../Routes/dataFetching.js';
import traceRouter from '../Routes/traceFetching.js';

const app = express();
app.set('json spaces', 2);
app.use(express.json());
app.use('/api', walletRouter);
app.use('/api', traceRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`ChainHound API listening on port ${PORT}`);
});
