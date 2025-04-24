const { authorize, uploadFile } = require('../utils/drive');

exports.handleUpload = async (req, res, next) => {
    try {
        const authClient = await authorize();
        const file = await uploadFile(authClient, req.file);
        const fileUrl = `https://drive.google.com/thumbnail?id=${file.data.id}`;
        res.status(200).json({ fileUrl });
    } catch (err) {
        next(err);
    }
};
