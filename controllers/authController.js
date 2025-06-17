const bcrypt = require('bcrypt')
const usuarioModel = require('../models/usuarioModel')
const jwt = require('jsonwebtoken')
const tokenModel = require('../models/tokenModel')
const register = async(req,res) =>{
    const {email,senha} = req.body
    try {
        const existente = await usuarioModel.buscarPorEmail(email)
        if (existente) return res.status(400).json({ erro: 'E-mail já cadastrado.' })

        const senhaHash = await bcrypt.hash(senha, 10)

        const usuario = await usuarioModel.criarUsuario(email, senhaHash)
        res.status(201).json({ mensagem: 'Usuário registrado com sucesso.', usuarioId: usuario.insertId })
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro interno no servidor.' })
    }
}

const login = async (req, res) => {
    const { email, senha } = req.body
    if (!email || !senha) return res.status(400).json({ erro: 'Email e senha são obrigatórios.' })

    try {
        const usuario = await usuarioModel.buscarPorEmail(email)
        if (!usuario) return res.status(401).json({ erro: 'Credenciais inválidas.' })

        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash)
        if (!senhaValida) return res.status(401).json({ erro: 'Credenciais inválidas.' })

        const payload = { id: usuario.id, email: usuario.email, role_id: usuario.role_id }

        const accessToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
            expiresIn: process.env.JWT_ACCESS_EXPIRATION
        })

        const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
            expiresIn: process.env.JWT_REFRESH_EXPIRATION
        })

        // ⚠️ Calcular data de expiração (pode ser mais robusto com JWT decode, mas isso resolve)
        const agora = new Date()
        const expiracao = new Date(agora.getTime() + 1000 * 60 * 60 * 24 * 7) // 7 dias

        await tokenModel.salvarRefreshToken(usuario.id, refreshToken, expiracao)

        res.json({ accessToken, refreshToken })
    } catch (err) {
        console.error(err)
        res.status(500).json({ erro: 'Erro interno no servidor.' })
    }
}

const renovarToken = async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(400).json({ erro: 'Refresh token é obrigatório.' })

  try {
    // Verifica se existe no banco e não expirou
    const tokenSalvo = await tokenModel.buscarToken(refreshToken)
    if (!tokenSalvo) return res.status(403).json({ erro: 'Refresh token inválido ou expirado.' })

    // Verifica se o token é válido com a chave
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, payload) => {
      if (err) return res.status(403).json({ erro: 'Refresh token inválido.' })

      const novoAccessToken = jwt.sign(
        {
          id: payload.id,
          email: payload.email,
          role_id: payload.role_id
        },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRATION }
      )

      res.json({ accessToken: novoAccessToken })
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro interno ao renovar token.' })
  }
}
const logout = async (req, res) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(400).json({ erro: 'Refresh token é obrigatório.' })

  try {
    await tokenModel.removerRefreshToken(refreshToken)
    res.json({ mensagem: 'Logout realizado com sucesso.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ erro: 'Erro interno ao realizar logout.' })
  }
}
module.exports = {
     register,
     login,
     renovarToken,
     logout
    };
