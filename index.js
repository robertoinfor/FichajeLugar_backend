const express = require('express');
const {Client} = require('@notionhq/client');
const cors = require('cors');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const port = process.env.PORT || 8000;
require('dotenv').config();

const app = express();
app.use(cors());

// Añadir como variables de entorno
const authToken = "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";
const notionDbID = "1a7879e4f8e480aea957eb64fa533cf3";
const notion = new Client ({auth: authToken});

app.post('/NotionAPIPost', jsonParser, async(req, res) => {
    const {Nombre, Pwd, Email, Rol, Fecha_alta} = req.body;
    try { 
        const response = await notion.pages.create({
            parent: {
                database_id: notionDbID,
            },
            properties: {
                Nombre: {
                    title: [
                        {
                            text: {
                                content: Nombre
                            },
                        },
                    ],
                },
                Pwd: {
                    rich_text: [
                        {
                            text: {
                                content: Pwd
                            },
                        },
                    ],
                },
                Email: {
                    rich_text: [
                        {
                            text: {
                                content: Email
                            },
                        },
                    ],
                },
                Rol: {
                    select: [
                        {
                            select: {
                                content: Rol
                            },
                        },
                    ],
                },
                Fecha_alta: {
                    rich_text: [
                        {
                            text: {
                                content: Fecha_alta
                            },
                        },
                    ],
                },
            },
        });

        res.send(response);
    } catch (error) {
        console.log(error);
    }
});

app.get('/NotionAPIGet', async(req, res) => {
    try { 
        const response = await notion.databases.query({
            database_id: notionDbID, 
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ]
        });

        res.send(response);
        const {results} = response;
    } catch (error) {
        console.log(error);
    }
});
app.get('/NotionAPIGet', async(req, res) => {
    try { 
        const response = await notion.databases.query({
            database_id: notionDbID, 
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ]
        });

        res.send(response);
        const {results} = response;
    } catch (error) {
        console.log(error);
    }
});

app.listen(port, () => {
    console.log('server listening on port 8000!');
});