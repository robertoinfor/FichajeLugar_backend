const { notion, db } = require('./notion');
const CryptoJS = require('crypto-js');
const key = process.env.ENCRYPTION_KEY;

// Devuelve la contraseña desencriptada de un usuario
async function decryptPwdByUserId(userId) {
    const userPage = await notion.pages.retrieve({ page_id: userId });
    const storedCipher = userPage.properties.Pwd.rich_text[0]?.text.content;
    const bytes = CryptoJS.AES.decrypt(storedCipher, key);
    return bytes.toString(CryptoJS.enc.Utf8);
}

// Según el token, desencripta la contrasela
async function decryptPwdByToken(token) {
    const resp = await notion.databases.query({
        database_id: db.tokenDB,
        filter: { property: 'Token', title: { equals: token } }
    });
    if (!resp.results.length) throw { status: 404, message: 'Token no encontrado' };

    const userId = resp.results[0].properties.Empleado.relation[0].id;
    return decryptPwdByUserId(userId);
}

module.exports = { decryptPwdByUserId, decryptPwdByToken };
