const Holidays = require('date-holidays');

exports.getPublicHolidays = (req, res, next) => {
    try {
        const year = parseInt(req.params.year, 10);
        const hd = new Holidays('ES', 'CN', '35');
        const list = hd.getHolidays(year).filter(h => h.type === 'public');
        res.json(list);
    } catch (err) {
        next(err);
    }
};
