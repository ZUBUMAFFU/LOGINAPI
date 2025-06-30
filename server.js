const express = require('express');
const { autenticarJWT } = require('./middlewares/authMiddleware');
const cors = require('cors');
require('dotenv').config();
const app = express();

// Middlewares de parsing e CORS
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rotas de autenticação
const authRoutes = require('./routes/authRoutes');
const pool = require('./utils/db');
app.use('/auth', authRoutes);

// Rota protegida de exemplo
app.get('/perfil', autenticarJWT, (req, res) => {
  res.json({ mensagem: 'Você está autenticado', usuario: req.user });
});

app.get('/usuarios', autenticarJWT, async (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM usuarios';
    const params = [];

    if (search) {
      sql += ' WHERE nome LIKE ? OR cpf LIKE ?';
      const busca = `%${search}%`;
      params.push(busca, busca);
    }

    const [usuarios] = await pool.query(sql, params);
    res.status(200).json({ usuarios });

  } catch (err) {
    console.error('Erro ao buscar usuários:', err.message);
    res.status(500).json({ erro: 'Erro interno ao buscar usuários.' });
  }
});
app.post('/usuarios/remove', autenticarJWT, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ erro: 'ID é obrigatório.' });
    }

    const [result] = await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Usuario não encontrado' });
    }

    res.json({ mensagem: 'Usuario deletado com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao deletar Usuario.' });
  }
});
app.get('/produtos', autenticarJWT, async (req, res) => {
  const search = req.query.search || '';
  try {
    let query = 'SELECT * FROM produtos';
    let params = [];

    if (search) {
      query += ' WHERE nome LIKE ? LIMIT 10';
      params.push(`%${search}%`);
    }

    const [produtos] = await pool.query(query, params);
    res.json(produtos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});
// Adicionar produto (mantém igual)
app.post('/produtos/add', autenticarJWT, async (req, res) => {
  try {
    const { nome, valor, quantidade, descricao } = req.body;

    if (!nome || !valor || !quantidade) {
      return res.status(400).json({ erro: 'Nome, valor e quantidade são obrigatórios.' });
    }

    const [result] = await pool.query(
      'INSERT INTO produtos (nome, valor, quantidade, descricao) VALUES (?, ?, ?, ?)',
      [nome, valor, quantidade, descricao || null]
    );

    res.status(201).json({ mensagem: 'Produto adicionado com sucesso.', produtoId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao adicionar produto.' });
  }
});
app.get('/produtos/:id', autenticarJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query('SELECT * FROM produtos WHERE id = ?', [id]);

    if (result.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar produto.' });
  }
});
// Editar produto
app.post('/produtos/edit', autenticarJWT, async (req, res) => {
  try {
    const { id, nome, valor, quantidade, descricao } = req.body;

    if (!id || !nome || !valor || !quantidade) {
      return res.status(400).json({ erro: 'ID, nome, valor e quantidade são obrigatórios.' });
    }

    const [result] = await pool.query(
      'UPDATE produtos SET nome = ?, valor = ?, quantidade = ?, descricao = ? WHERE id = ?',
      [nome, valor, quantidade, descricao || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    res.json({ mensagem: 'Produto atualizado com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar produto.' });
  }
});

// remover produto
app.post('/produtos/remove', autenticarJWT, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ erro: 'ID é obrigatório.' });
    }

    const [result] = await pool.query('DELETE FROM produtos WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    res.json({ mensagem: 'Produto deletado com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao deletar produto.' });
  }
});

app.get('/vendas', autenticarJWT, async (req, res) => {
  try {
    const [vendas] = await pool.query('SELECT * FROM vendas');
    res.json( vendas );
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar vendasa.' });
  }
});
app.get('/vendas/total', autenticarJWT, async (req, res) => {
  try {
    const [resultado] = await pool.query('SELECT SUM(valor) AS total FROM vendas');
    res.json({ total: resultado[0].total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao calcular o total das vendas.' });
  }
});
// registrar venda
// Modificado para usar o nome do produto em vez do ID
app.post('/vendas/vender', autenticarJWT, async (req, res) => {
  try {
    const { produto, cliente, peso, valor } = req.body;

    if (!produto || !cliente || !peso || !valor) {
      return res.status(400).json({ erro: 'produto, cliente, peso e valor são obrigatórios.' });
    }

    // Buscar o ID do produto e quantidade atual pelo nome
    const [produtos] = await pool.query('SELECT id, quantidade FROM produtos WHERE nome = ?', [produto]);

    if (produtos.length === 0) {
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    const produtoId = produtos[0].id;
    const quantidadeAtual = Number(produtos[0].quantidade);

    // Verificar se há quantidade suficiente para a venda
    if (quantidadeAtual < peso) {
      return res.status(400).json({ erro: 'Quantidade insuficiente no estoque para essa venda.' });
    }

    // Registrar venda com nome do produto
    const [result] = await pool.query(
      'INSERT INTO vendas (produto, cliente, peso, valor) VALUES (?, ?, ?, ?)',
      [produto, cliente, peso, valor]
    );

    // Atualizar quantidade usando o ID correto
    await pool.query(
      'UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?',
      [peso, produtoId]
    );

    res.status(201).json({ mensagem: 'Venda registrada com sucesso.', vendaId: result.insertId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao registrar venda.' });
  }
});

app.post('/vendas/periodo', async (req, res) => {
  try {
    const { mesInicio, mesTermino } = req.body;

    if (!mesInicio || !mesTermino) {
      return res.status(400).json({ erro: 'mesInicio e mesTermino são obrigatórios.' });
    }

    // Construir datas início e fim do período
    const inicio = mesInicio + '-01';
    const ultimoDia = new Date(new Date(mesTermino + '-01').getFullYear(), new Date(mesTermino + '-01').getMonth() + 1, 0).getDate();
    const fim = mesTermino + '-' + String(ultimoDia).padStart(2, '0');

    // Busca as vendas
    const sqlVendas = `
      SELECT * FROM vendas
      WHERE DATE(vendido_em) BETWEEN ? AND ?
      ORDER BY vendido_em ASC
    `;
    const [vendas] = await pool.execute(sqlVendas, [inicio, fim]);

    // Soma o total das vendas (assumindo que o campo é 'valor' ou 'total')
    const sqlTotal = `
      SELECT SUM(valor) AS totalGeral FROM vendas
      WHERE DATE(vendido_em) BETWEEN ? AND ?
    `;
    const [soma] = await pool.execute(sqlTotal, [inicio, fim]);

    res.json({
      vendas,
      totalGeral: soma[0].totalGeral || 0
    });

  } catch (error) {
    console.error('Erro no /vendas/periodo:', error);
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
});

// Rota para buscar materiais
app.get('/material', autenticarJWT, async (req, res) => {
  try {
    const [material] = await pool.query('SELECT * FROM materia_prima');
    res.json(material);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar material.' });
  }
});
// Rota para adicionar material
app.post('/material/add', autenticarJWT, async (req, res) => {
  try {
    const { nome, quantidade, descricao } = req.body;

    if (!nome || !quantidade) {
      return res.status(400).json({ erro: 'Nome e quantidade são obrigatórios.' });
    }

    const [result] = await pool.query(
      'INSERT INTO materia_prima (nome, quantidade, descricao) VALUES (?, ?, ?)',
      [nome, quantidade, descricao || null]
    );

    res.status(201).json({ mensagem: 'Material adicionado com sucesso.', materialId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao adicionar material.' });
  }
});
//rota para editar material
app.post('/material/edit', autenticarJWT, async (req, res) => {
  try {
    const { id, nome, quantidade, descricao } = req.body;

    if (!id || !nome || !quantidade) {
      return res.status(400).json({ erro: 'ID, nome, valor e quantidade são obrigatórios.' });
    }

    const [result] = await pool.query(
      'UPDATE materia_prima SET nome = ?, quantidade = ?, descricao = ? WHERE id = ?',
      [nome, quantidade, descricao || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Material não encontrado.' });
    }

    res.json({ mensagem: 'Material atualizado com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar material.' });
  }
});
// Rota para remover material
app.post('/material/remove', autenticarJWT, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ erro: 'ID é obrigatório.' });
    }

    const [result] = await pool.query('DELETE FROM materia_prima WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Material não encontrado.' });
    }

    res.json({ mensagem: 'Material deletado com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao deletar Material.' });
  }
});
// Buscar máquinas
app.get('/maquinas', autenticarJWT, async (req, res) => {
  try {
    const search = req.query.search || '';
    let query = 'SELECT * FROM maquinas';
    const params = [];

    if (search) {
      query += ' WHERE nome LIKE ? LIMIT 10';
      params.push(`%${search}%`);
    }

    const [maquinas] = await pool.query(query, params);
    res.json(maquinas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar máquinas.' });
  }
});

// Adicionar máquina
app.post('/maquinas/add', autenticarJWT, async (req, res) => {
  try {
    const { nome } = req.body;

    if (!nome) {
      return res.status(400).json({ erro: 'O nome da máquina é obrigatório.' });
    }

    const [result] = await pool.query(
      'INSERT INTO maquinas (nome) VALUES (?)',
      [nome]
    );

    res.status(201).json({ mensagem: 'Máquina adicionada com sucesso.', maquinaId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao adicionar máquina.' });
  }
});

//editar máquina
app.post('/maquinas/edit', autenticarJWT, async (req, res) => {
  try {
    const { id, nome } = req.body;

    if (!id || !nome) {
      return res.status(400).json({ erro: 'ID e nome são obrigatórios.' });
    }

    const [result] = await pool.query(
      'UPDATE maquinas SET nome = ? WHERE id = ?',
      [nome, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Máquina não encontrada.' });
    }

    res.json({ mensagem: 'Máquina atualizada com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar máquina.' });
  }
});
//remover maquina
app.post('/maquinas/remove', autenticarJWT, async (req, res) => {
  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ erro: 'ID é obrigatório.' });
    }

    const [result] = await pool.query('DELETE FROM maquinas WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Máquina não encontrada.' });
    }

    res.json({ mensagem: 'Máquina deletada com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao deletar máquina.' });
  }
});
//buscar ficha de extrusão
app.get('/ficha_extrusao', autenticarJWT, async (req, res) => {
  try {
    const [fichas] = await pool.query('SELECT * FROM work_ficha');
    res.json(fichas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar fichas de extrusão.' });
  }
});
app.post('/ficha_extrusao/add', autenticarJWT, async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { 
      operador_nome,
      operador_cpf,
      operador_maquina,
      inicio,
      termino,
      produto,
      peso,
      aparas,
      obs
    } = req.body;

    // Validação básica
    if (!operador_nome || !operador_cpf || !operador_maquina || !inicio || !termino || !produto || !peso) {
      return res.status(400).json({ erro: 'Todos os campos obrigatórios devem ser preenchidos.' });
    }

    // Validação de tipos
    const pesoNum = parseFloat(peso);
    if (isNaN(pesoNum)) {
      return res.status(400).json({ erro: 'O peso deve ser um número válido.' });
    }

    // Validação de datas
    if (new Date(inicio) > new Date(termino)) {
      return res.status(400).json({ erro: 'A data de término não pode ser anterior à data de início.' });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO work_ficha 
        (operador_nome, operador_cpf, operador_maquina, inicio, termino, produto, peso, aparas, obs) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operador_nome, 
        operador_cpf, 
        operador_maquina, 
        inicio, 
        termino, 
        produto, 
        pesoNum, 
        aparas !== undefined ? parseFloat(aparas) : null, 
        obs !== undefined ? obs : null
      ]
    );
    await connection.query(
  `UPDATE produtos 
   SET quantidade = quantidade + ? 
   WHERE nome = ?`,
  [pesoNum, produto]
);
    await connection.commit();
    
    res.status(201).json({ 
      mensagem: 'Ficha de extrusão adicionada com sucesso.', 
      fichaId: result.insertId 
    });
  } catch (err) {
    await connection.rollback();
    
    console.error('Erro ao adicionar ficha:', {
      erro: err.message,
      stack: err.stack,
      body: req.body,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      erro: 'Erro ao adicionar ficha de extrusão.',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : null
    });
  } finally {
    connection.release();
  }
});
//iniciar a aplicação
app.listen(3000, () => console.log('Servidor rodando na porta 3000'));