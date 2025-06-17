const express = require('express');
const autenticarJWT = require('./middlewares/authMiddleware');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares de parsing e CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas de autenticação
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

// Rota protegida de exemplo
app.get('/perfil', autenticarJWT, (req, res) => {
  res.json({ mensagem: 'Você está autenticado', usuario: req.user });
});

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));