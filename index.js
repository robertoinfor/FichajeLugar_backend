const cors = require('cors');
const bodyParser = require('body-parser');
const port = process.env.PORT || 8000;

require('dotenv').config();
require('./cron/storeSignings');
require('./cron/sendNotifications');

const app = require('./app');

app.use(cors());
app.use(bodyParser.json());

app.listen(port, () => {
    console.log('server listening on port '+ port);
});