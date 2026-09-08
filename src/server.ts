import express from 'express';
import walletRouter from '../Routes/dataFetching.js';

const app = express();
app.set('json spaces', 2);
app.use(express.json());
app.use('/api', walletRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`ChainHound API listening on port ${PORT}`);
});
