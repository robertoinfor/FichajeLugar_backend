const { decryptPwdByToken } = require('../utils/password');
const { notion, db, getFromDatabase } = require('../utils/notion');
const Crypto = require('crypto-js');
const nodemailer = require('nodemailer');

// Verifico que existe el token para devolver la contraseña
exports.decrypt = async (req, res, next) => {
    try {
        const { token } = req.body;
        const password = await decryptPwdByToken(token);
        res.json({ password });
    } catch (err) {
        next(err);
    }
};

// Guardo un token para desencriptar la contraseña de un usuario
exports.postToken = async (req, res) => {
    const Id = Crypto.lib.WordArray.random(8).toString();
    const { Empleado } = req.body;
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15)
    try {
        const response = await notion.pages.create({
            parent: {
                database_id: db.tokenDB,
            },
            properties: {
                Generado: {
                    date: {
                        start: new Date().toISOString()
                    },
                },
                Empleado: {
                    relation: [{
                        id: Empleado
                    },],
                },
                Caduca: {
                    date: {
                        start: now.toISOString()
                    }
                },
                Token: {
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
        return res.status(200).json({ tokenId: response.id });
    } catch (error) {
        console.log(error);
    }
};

// Envío el token al correo
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

// Borro un token de la base de datos
exports.deleteToken = async (req, res) => {
    const { id } = req.params;
    try {
        const response = await notion.pages.update({
            page_id: id,
            archived: true,
        });
        if (response) {
            return res.status(200).send({ message: 'Token eliminado correctamente' });
        } else {
            return res.status(400).send({ message: 'Error al archivar el token' });
        }
    } catch (error) {
        console.error('Error al hacer la solicitud a Notion:', error);
        return res.status(500).send({ message: 'Error al eliminar el token', error });
    }
};

// Recojo todos los tokens de recuperación de contraseña
exports.getTokens = async (req, res) => {
    try {
        const results = await getFromDatabase(
            db.tokenDB,
            null,
            [{ timestamp: 'created_time', direction: 'descending' }]
        );
        res.send({ results });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: error.message });
    }
};