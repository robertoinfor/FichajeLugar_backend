const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const port = process.env.PORT || 8000;
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Añadir como variables de entorno
const authToken = "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";
const usuariosDb = "1a7879e4f8e480aea957eb64fa533cf3";
const fichajeDb = "1a7879e4f8e4800689f7fff9be6f5c1f";
const notion = new Client({ auth: authToken });

app.post('/PostUser', jsonParser, async (req, res) => {
    const { Nombre, Pwd, Email, Rol, Fecha_alta } = req.body;
    try {
        const response = await notion.pages.create({
            parent: {
                database_id: usuariosDb,
            },
            properties: {
                Nombre: {
                    title: [{
                        text: {
                            content: Nombre
                        },
                    },],
                },
                Pwd: {
                    rich_text: [{
                        text: {
                            content: Pwd
                        },
                    },],
                },
                Email: {
                    email: Email
                },
                Rol: {
                    select: {
                        name: Rol
                    },

                },
                Fecha_alta: {
                    date:
                    {
                        start: Fecha_alta
                    },
                },
            },
        });

        res.send(response);
    } catch (error) {
        console.log(error);
    }
});

app.get('/GetUsers', async (req, res) => {
    try {
        const response = await notion.databases.query({
            database_id: usuariosDb,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ]
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.delete('/DeleteUser/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.pages.update(
            {
                page_id: id,
                archived: true,
            }
        );
        if (response) {
            return res.status(200).send({ message: 'Usuario archivado correctamente' });
        } else {
            return res.status(400).send({ message: 'Error al archivar el usuario' });
        }
    } catch (error) {
        console.error('Error al hacer la solicitud a Notion:', error);
        return res.status(500).send({ message: 'Error al eliminar el usuario', error });
    }
});

app.put("/UpdateUser/:id", async (req, res) => {
    const { id } = req.params;
    const { Nombre, Pwd, Email, Rol, Fecha_alta } = req.body;

    try {
        const response = await notion.pages.update(
            {
                page_id: id,
            },
            {
                properties: {
                    Nombre: { title: [{ text: { content: Nombre } }] },
                    Email: { email: Email },
                    Pwd: { rich_text: [{ text: { content: Pwd }, },], },
                    Rol: { select: { name: Rol } },
                    Fecha_alta: { date: { start: Fecha_alta } },
                },
            },
        );

        res.status(200).json({ message: "Usuario actualizado", data: response.data });
    } catch (error) {
        console.error("Error actualizando usuario:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/GetSignings', async (req, res) => {
    try {
        const response = await notion.databases.query({
            database_id: fichajeDb,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ]
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.listen(port, () => {
    console.log('server listening on port 8000!');
});