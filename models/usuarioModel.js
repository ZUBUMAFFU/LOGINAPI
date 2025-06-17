const pool = require('../utils/db')

const buscarPorEmail = async (email) => {
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email])
    return rows[0]
}

const criarUsuario = async (email, senhaHash) => {
    const rolePadrao = 2 // ID do role "user"
    return await pool.query(
        'INSERT INTO usuarios (email, senha_hash, role_id) VALUES (?, ?, ?)',
        [email, senhaHash, rolePadrao]
    )
}

module.exports = { buscarPorEmail, criarUsuario }
