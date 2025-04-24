const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
app.use(cors(), bodyParser.json());

const usersRoutes = require('./routes/users');
const signingsRoutes = require('./routes/signings')
const tokensRoutes = require('./routes/tokens')
const locationsRoutes = require('./routes/locations')
const fcmRoutes = require('./routes/fcm');
const holidaysRoutes = require('./routes/holidays')
const driveRoutes = require('./routes/drive')

app.use(cors(), bodyParser.json());

app.use(async (req, res, next) => {
  const start = Date.now();
  res.once('finish', () => {
    console.log(`${req.method} ${req.originalUrl} → ${Date.now() - start}ms`);
  });
  next();
});

app.use('/users', usersRoutes);
app.use('/signings', signingsRoutes);
app.use('/tokens', tokensRoutes);
app.use('/locations', locationsRoutes);
app.use('/fcm', fcmRoutes);
app.use('/holidays', holidaysRoutes);
app.use('/drive', driveRoutes);

module.exports = app;
