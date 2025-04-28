const { notion, db, getFromDatabase } = require('../utils/notion');
const { encrypt, decrypt } = require('../utils/crypto');
const { decryptPwdByUserId } = require('../utils/password');

exports.createUser = async (req, res, next) => {
  try {
    const {
      'Nombre de usuario': Nombre_usuario,
      'Nombre completo': Nombre_completo,
      Pwd, Email, Rol, Fecha_alta, Horas, Foto
    } = req.body;

    const hash = encrypt(Pwd);

    const response = await notion.pages.create({
      parent: { database_id: db.usuariosDb },
      properties: {
        "Nombre de usuario": { title: [{ text: { content: Nombre_usuario } }] },
        "Nombre completo": { rich_text: [{ text: { content: Nombre_completo } }] },
        "Pwd": { rich_text: [{ text: { content: hash } }] },
        "Email": { email: Email },
        "Rol": { select: { name: Rol } },
        "Fecha_alta": { date: { start: Fecha_alta } },
        "Horas": { number: Horas },
        "Foto": Foto,
        "Estado": { status: { name: "Activo" } },
        "Conexion": { status: { name: "Desconectado" } }
      }
    });

    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const results = await getFromDatabase(
      db.usuariosDb,
      null,
      [{ timestamp: 'created_time', direction: 'descending' }]
    );
    res.json({ results });
  } catch (err) {
    next(err);
  }
};

exports.getUserByName = async (req, res, next) => {
  try {
    const name = req.params.name;
    const results = await getFromDatabase(
      db.usuariosDb,
      { property: "Nombre de usuario", title: { equals: name } },
      [{ timestamp: 'created_time', direction: 'descending' }]
    );
    res.json({ results });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { login, password } = req.body;
    const resp = await notion.databases.query({
      database_id: db.usuariosDb,
      filter: {
        or: [
          { property: "Email", email: { equals: login } },
          { property: "Nombre de usuario", title: { equals: login } }
        ]
      }
    });

    if (!resp.results.length) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    const user = resp.results[0];
    const stored = user.properties.Pwd.rich_text[0]?.text.content;
    if (decrypt(stored) !== password) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    res.json({
      id: user.id,
      nombre: user.properties["Nombre de usuario"].title[0]?.plain_text,
      email: user.properties.Email.email,
      rol: user.properties.Rol.select.name,
      fecha_alta: user.properties.Fecha_alta.date.start
    });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      'Nombre de usuario': Nombre_usuario,
      'Nombre completo': Nombre_completo,
      Pwd, Email, Rol, Fecha_alta, Horas, Foto
    } = req.body;

    const hash = encrypt(Pwd);

    const response = await notion.pages.update({
      page_id: id,
      properties: {
        "Nombre de usuario": { title: [{ text: { content: Nombre_usuario } }] },
        "Nombre completo": { rich_text: [{ text: { content: Nombre_completo } }] },
        "Pwd": { rich_text: [{ text: { content: hash } }] },
        "Email": { email: Email },
        "Rol": { select: { name: Rol } },
        "Fecha_alta": { date: { start: Fecha_alta } },
        "Horas": { number: Horas },
        "Foto": Foto
      }
    });

    res.json({ message: 'Usuario actualizado', data: response });
  } catch (err) {
    next(err);
  }
};

exports.updateUserState = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { Estado } = req.body;
    await notion.pages.update({
      page_id: id,
      properties: { Estado: { status: { name: Estado } } }
    });
    res.json({ message: 'Estado de usuario actualizado' });
  } catch (err) {
    next(err);
  }
};

exports.updateUserLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { Conexion } = req.body;
    await notion.pages.update({
      page_id: id,
      properties: { Conexion: { status: { name: Conexion } } }
    });
    res.json({ message: 'Estado de conexión actualizado' });
  } catch (err) {
    next(err);
  }
};

exports.decrypt = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const password = await decryptPwdByUserId(userId);
    res.json({ password });
  } catch (err) {
    next(err);
  }
};