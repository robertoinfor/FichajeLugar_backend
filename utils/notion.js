const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.TOKEN_NOTION });
const db = {
    usuariosDb: process.env.USERSDB_KEY,
    fichajeDb: process.env.SIGNINGS_KEY,
    tokenDB: process.env.TOKENS_KEY,
    fcmDB: process.env.FCM_KEY,
    placesDB: process.env.PLACES_KEY,
    historicDB: process.env.HISTORIC_KEY
};

async function getFromDatabase(databaseId, filter = null, sorts = null) {
    const q = { database_id: databaseId };
    if (filter) q.filter = filter;
    if (sorts)  q.sorts  = sorts;
    const resp = await notion.databases.query(q);
    return resp.results;
  }

module.exports = { notion, db, getFromDatabase };
