const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');
const bodyParser = require('body-parser');
const jsonParser = bodyParser.json();
const port = process.env.PORT || 8000;
require('dotenv').config();
const Crypto = require('crypto-js');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const authToken = process.env.TOKEN_NOTION
const usuariosDb = process.env.USERSDB_KEY
const fichajeDb = process.env.SIGNINGS_KEY
const tokenDB = process.env.TOKENS_KEY
const notion = new Client({ auth: authToken })
const key = process.env.ENCRYPTION_KEY;

app.post('/PostUser', jsonParser, async (req, res) => {
    const { Nombre, Pwd, Email, Rol, Fecha_alta, Horas } = req.body;
    try {
        const hash = Crypto.AES.encrypt(Pwd, key).toString();
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
                            content: hash
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
                Horas: { number: Horas }
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

app.post('/login', async (req, res) => {
    const { login, password } = req.body;
    try {
        const response = await notion.databases.query({
            database_id: usuariosDb,
            filter: {
                or: [
                    {
                        property: "Email",
                        email: { equals: login }
                    },
                    {
                        property: "Nombre",
                        title: { contains: login }
                    }
                ]
            }
        });

        if (response.results.length === 0) {
            return res.status(404).json({ message: "Usuario no encontrado" });
        }

        const usuario = response.results[0];
        const storedPassword = usuario.properties.Pwd.rich_text[0]?.text.content;
        const bytes = Crypto.AES.decrypt(storedPassword, key);
        var originalPwd = bytes.toString(Crypto.enc.Utf8);

        if (password !== originalPwd) {
            return res.status(401).json({ message: "Contraseña incorrecta" });
        }

        res.status(200).json({
            id: usuario.id,
            nombre: usuario.properties.Nombre.title[0]?.plain_text,
            email: usuario.properties.Email.email,
            Pwd: usuario.properties.Pwd.rich_text[0].text.content,
            rol: usuario.properties.Rol.select.name,
            fecha_alta: usuario.properties.Fecha_alta.date.start
        });

    } catch (error) {
        console.error("Error en login:", error);
        res.status(500).json({ message: "Error en el servidor", error });
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
    const { Nombre, Pwd, Email, Rol, Fecha_alta, Horas } = req.body;
    const hash = await bcrypt.hash(Pwd, 10)

    try {
        const user = await notion.pages.retrieve({ page_id: id });

        const currentPwd = user.properties.Pwd.rich_text[0]?.text.content || "";

        const hash = Pwd === currentPwd ? currentPwd : await bcrypt.hash(Pwd, 10);
        const response = await notion.pages.update(
            {
                page_id: id,
                properties: {
                    Nombre: { title: [{ text: { content: Nombre } }] },
                    Email: { email: Email },
                    Pwd: { rich_text: [{ text: { content: hash }, },], },
                    Rol: { select: { name: Rol } },
                    Fecha_alta: { date: { start: Fecha_alta } },
                    Horas: { number: Horas }
                },
            },
        );
    } catch (error) {
        console.error("Error actualizando usuario:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/GetUserByName/:name', async (req, res) => {
    const { name } = req.params;
    try {
        const response = await notion.databases.query({
            database_id: usuariosDb,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ],
            filter: {
                property: "Nombre",
                title: { equals: name }
            }
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.post('/GetDecryptedPassword', jsonParser, async (req, res) => {
    const { token } = req.body;
    try {
        const response = await notion.databases.query({
            database_id: tokenDB,
            filter: {
                property: "Id",
                title: { equals: token }
            }
        });

        if (response.results.length === 0) {
            return res.status(404).json({ message: "Token no encontrado" });
        }

        const userId = response.results[0].properties.Empleado.relation[0].id;

        const userResponse = await notion.pages.retrieve({ page_id: userId });
        const storedPassword = userResponse.properties.Pwd.rich_text[0]?.text.content;

        const bytes = Crypto.AES.decrypt(storedPassword, key);
        const decryptedPassword = bytes.toString(Crypto.enc.Utf8);

        res.status(200).json({ password: decryptedPassword });
    } catch (error) {
        console.error("Error al obtener la contraseña:", error);
        res.status(500).json({ message: "Error en el servidor", error });
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

app.get('/GetSigningUser/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.databases.query({
            database_id: fichajeDb,
            sorts: [
                {
                    timestamp: 'created_time',
                    direction: 'descending',
                },
            ],
            filter: {
                property: "Empleado",
                relation: { contains: id }
            }
        });

        res.send(response);
        const { results } = response;
    } catch (error) {
        console.log(error);
    }
});

app.post('/PostSigning', jsonParser, async (req, res) => {
    const { Id, Empleado, Tipo, Fecha_hora } = req.body;
    try {
        const response = await notion.pages.create({
            parent: {
                database_id: fichajeDb,
            },
            properties: {
                Fecha_hora: {
                    date: {
                        start: Fecha_hora
                    },
                },
                Empleado: {
                    relation: [{
                        id: Empleado
                    },],
                },
                Tipo: {
                    select: {
                        name: Tipo,
                    }
                },
                Id: {
                    title: [{
                        text: {
                            content: Id
                        }
                    }
                    ]
                },
            },
        });
        res.send(response);
    } catch (error) {
        console.log(error);
    }
});



app.get('/GetTokens', async (req, res) => {
    try {
        const response = await notion.databases.query({
            database_id: tokenDB,
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

app.post('/PostToken', jsonParser, async (req, res) => {
    const { Id, Generado, Empleado, Caduca, Estado } = req.body;
    try {
        const response = await notion.pages.create({
            parent: {
                database_id: tokenDB,
            },
            properties: {
                Generado: {
                    date: {
                        start: Generado
                    },
                },
                Empleado: {
                    relation: [{
                        id: Empleado
                    },],
                },
                Caduca: {
                    date: {
                        start: Caduca
                    }
                },
                Estado: {
                    status: {
                        name: Estado
                    }
                },
                Id: {
                    title: [{
                        text: {
                            content: Id
                        }
                    }
                    ]
                },
            },
        });
        const userResponse = await notion.pages.retrieve({ page_id: Empleado });
        const userEmail = userResponse.properties.Email.email;
        await sendTokenEmail(userEmail, Id);
        res.send(response);
    } catch (error) {
        console.log(error);
    }
});

async function sendTokenEmail(userEmail, token) {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'robertoinfor03@gmail.com',
            pass: 'cqdi fptn qnxx jarf'
        }
    });

    const mailOptions = {
        from: '"Soporte" <tuemail@gmail.com>',
        to: userEmail,
        subject: "Recuperación de Contraseña",
        text: `Tu código de verificación es: ${token}. Expira en 15 minutos.`,
        html: `<p>Tu código de verificación es: <strong>${token}</strong>. Expira en <strong>15 minutos</strong>.</p>`
    };

    await transporter.sendMail(mailOptions);
}


app.listen(port, () => {
    console.log('server listening on port 8000!');
});