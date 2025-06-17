const jwt = require('jsonwebtoken')

const autenticarJWT = (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (!authHeader) return res.status(401).json({ erro: 'Token não fornecido.' })

  const token = authHeader.split(' ')[1] // Bearer <token>
  if (!token) return res.status(401).json({ erro: 'Token mal formatado.' })

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ erro: 'Token inválido.' })
    req.user = payload // salva os dados do usuário no request para usar depois
    next()
  })
}

module.exports = autenticarJWT