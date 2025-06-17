module.exports = (req, res, next) => {
    const { email, senha } = req.body || {};

    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios.' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ erro: 'Email inválido.' });

    if (senha.length < 6) return res.status(400).json({ erro: 'Senha deve ter no mínimo 6 caracteres.' });

    next();
};