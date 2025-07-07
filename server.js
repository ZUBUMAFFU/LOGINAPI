const express = require('express');
const { autenticarJWT } = require('./middlewares/authMiddleware');
const cors = require('cors');
const bcrypt = require('bcrypt');
const ExcelJS = require('exceljs');
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
app.get('/usuarios/:id', autenticarJWT, async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.query('SELECT * FROM usuarios WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    res.status(200).json(rows[0]);

  } catch (err) {
    console.error('Erro ao buscar usuário por ID:', err.message);
    res.status(500).json({ erro: 'Erro interno ao buscar usuário.' });
  }
});


app.post('/usuarios/edit', autenticarJWT, async (req, res) => {
  try {
    const { id, nome, cpf, senha, role_id } = req.body;

    if (!id || !nome || !cpf || !role_id) {
      return res.status(400).json({ erro: 'ID, nome, CPF e role_id são obrigatórios.' });
    }

    let query = '';
    let params = [];

    if (senha && senha.trim() !== '') {
      const saltRounds = 10;
      const hashSenha = await bcrypt.hash(senha, saltRounds);

      query = `
        UPDATE usuarios 
        SET nome = ?, cpf = ?, senha_hash = ?, role_id = ? 
        WHERE id = ?
      `;
      params = [nome, cpf, hashSenha, role_id, id];
    } else {
      query = `
        UPDATE usuarios 
        SET nome = ?, cpf = ?, role_id = ? 
        WHERE id = ?
      `;
      params = [nome, cpf, role_id, id];
    }

    const [result] = await pool.query(query, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    res.json({ mensagem: 'Usuário atualizado com sucesso.' });

  } catch (err) {
    console.error('Erro ao editar usuário:', err);
    res.status(500).json({ erro: 'Erro interno ao editar usuário.' });
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
  const page = parseInt(req.query.page) || 1;     // página atual
  const limit = parseInt(req.query.limit) || 10;  // registros por página
  const offset = (page - 1) * limit;              // deslocamento

  try {
    // Busca as vendas com limite e offset
    const [vendas] = await pool.query('SELECT * FROM vendas LIMIT ? OFFSET ?', [limit, offset]);

    // Total de vendas (sem paginação)
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM vendas');

    res.json({
      data: vendas,
      page,
      total,
      totalPages: Math.ceil(total / limit)
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar vendas.' });
  }
});
app.get('/vendas_all', autenticarJWT, async (req, res) => {
  try {
    const [vendas] = await pool.query('SELECT * FROM vendas');
    res.json({ vendas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar vendas.' });
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

// Buscar venda por ID
app.get('/vendas/:id', autenticarJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query('SELECT * FROM vendas WHERE id = ?', [id]);

    if (result.length === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada.' });
    }

    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar venda.' });
  }
});

// Editar venda
app.post('/vendas/edit', autenticarJWT, async (req, res) => {
  try {
    const { id, cliente, produto, valor, peso } = req.body;

    if (!id || !cliente || !produto || valor == null) {
      return res.status(400).json({ erro: 'Campos obrigatórios não preenchidos.' });
    }

    const [result] = await pool.query(
      'UPDATE vendas SET cliente = ?, produto = ?, valor = ?, peso = ? WHERE id = ?',
      [cliente, produto, valor, peso ?? 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ erro: 'Venda não encontrada.' });
    }

    res.json({ mensagem: 'Venda atualizada com sucesso.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar venda.' });
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
app.get('/maquinas/:id', autenticarJWT, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query('SELECT * FROM maquinas WHERE id = ?', [id]);

    if (result.length === 0) {
      return res.status(404).json({ erro: 'Máquina não encontrada.' });
    }

    res.json(result[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar maquina.' });
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
//rota para adicionar ficha de extrusão
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
//buscar ficha de corte
app.get('/ficha_corte', autenticarJWT, async (req, res) => {
  try {
    const [fichas] = await pool.query('SELECT * FROM work_ficha');
    res.json(fichas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar fichas de extrusão.' });
  }
});
//rota para adicionar ficha de corte
app.post('/ficha_corte/add', autenticarJWT, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const { 
      operador_nome,
      operador_cpf,
      maquina,
      turno,               // <-- novo campo
      sacola_dim,
      total,
      aparas,
      obs
    } = req.body;

    if (!operador_nome || !operador_cpf || !sacola_dim || !total || !turno) {
      return res.status(400).json({ erro: 'Campos obrigatórios não preenchidos.' });
    }

    const totalNum = parseFloat(total);
    const aparasNum = aparas !== undefined ? parseFloat(aparas) : null;

    if (isNaN(totalNum)) {
      return res.status(400).json({ erro: 'O total deve ser um número válido.' });
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO corte_ficha 
        (operador_nome, operador_cpf, maquina, turno, sacola_dim, total, aparas, obs, preenchido_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        operador_nome,
        operador_cpf,
        maquina,
        turno,
        sacola_dim,
        totalNum,
        aparasNum,
        obs || null
      ]
    );
    // Atualizar quantidade de sacolas no estoque
    await connection.query(
  `UPDATE produtos 
   SET quantidade = quantidade + ? 
   WHERE nome = ?`,
  [totalNum, sacola_dim]
);
    await connection.commit();

    res.status(201).json({ 
      mensagem: 'Ficha de corte adicionada com sucesso.', 
      fichaId: result.insertId 
    });
  } catch (err) {
    await connection.rollback();

    console.error('Erro ao adicionar ficha de corte:', {
      erro: err.message,
      stack: err.stack,
      body: req.body,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({ 
      erro: 'Erro ao adicionar ficha de corte.',
      detalhes: process.env.NODE_ENV === 'development' ? err.message : null
    });
  } finally {
    connection.release();
  }
});


//rota para relatorio de extrusão por periodo
app.post('/relatorio/extrusao', autenticarJWT, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { data_inicio, data_fim } = req.body;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({ erro: 'data_inicio e data_fim são obrigatórios.' });
    }

    const query = `
      SELECT * FROM work_ficha 
      WHERE preenchido_em BETWEEN ? AND ?
    `;
    const [dados] = await connection.query(query, [data_inicio, data_fim]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Extrusão');

    // ... (mesmo código para montar a planilha e adicionar os dados, bordas, totais) ...

    // Estilo de borda
    const borderStyle = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    sheet.columns = [
      { header: 'data', key: 'preenchido_em', width: 15 },
      { header: 'nome', key: 'operador_nome', width: 25 },
      { header: 'cpf', key: 'operador_cpf', width: 18 },
      { header: 'maquina', key: 'operador_maquina', width: 20 },
      { header: 'inicio', key: 'inicio', width: 12 },
      { header: 'termino', key: 'termino', width: 12 },
      { header: 'produto', key: 'produto', width: 18 },
      { header: 'peso', key: 'peso', width: 10 },
      { header: 'aparas', key: 'aparas', width: 10 },
      { header: 'obs', key: 'obs', width: 30 },
    ];

    // Cabeçalho estilizado
    sheet.getRow(1).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00B050' }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = borderStyle;
    });

    let totalPeso = 0;
    let totalAparas = 0;

    dados.forEach(d => {
      const row = sheet.addRow(d);
      row.eachCell(cell => {
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      totalPeso += Number(d.peso || 0);
      totalAparas += Number(d.aparas || 0);
    });

    const ultimaLinha = sheet.rowCount + 2;

    // Total Geral
    sheet.mergeCells(`F${ultimaLinha}:G${ultimaLinha}`);
    sheet.getCell(`F${ultimaLinha}`).value = 'Total Geral:';
    sheet.getCell(`F${ultimaLinha}`).font = { bold: true };
    sheet.getCell(`F${ultimaLinha}`).alignment = { horizontal: 'right' };
    sheet.getCell(`F${ultimaLinha}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B050' }
    };
    sheet.getCell(`H${ultimaLinha}`).value = totalPeso;
    sheet.getCell(`H${ultimaLinha}`).font = { bold: true };
    sheet.getCell(`H${ultimaLinha}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF99' }
    };

    // Total Aparas
    sheet.mergeCells(`F${ultimaLinha + 1}:G${ultimaLinha + 1}`);
    sheet.getCell(`F${ultimaLinha + 1}`).value = 'Total de Aparas:';
    sheet.getCell(`F${ultimaLinha + 1}`).font = { bold: true };
    sheet.getCell(`F${ultimaLinha + 1}`).alignment = { horizontal: 'right' };
    sheet.getCell(`F${ultimaLinha + 1}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B050' }
    };
    sheet.getCell(`H${ultimaLinha + 1}`).value = totalAparas;
    sheet.getCell(`H${ultimaLinha + 1}`).font = { bold: true };
    sheet.getCell(`H${ultimaLinha + 1}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF99' }
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_extrusao.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar planilha.' });
  } finally {
    connection.release();
  }
});

///////////////////////

//rota para relatorio de extrusão
app.get('/relatorio/extrusao', autenticarJWT, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [dados] = await connection.query('SELECT * FROM work_ficha');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Extrusão');

    // Estilo de borda
    const borderStyle = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    // Cabeçalho
    sheet.columns = [
      { header: 'data', key: 'preenchido_em', width: 15 },
      { header: 'nome', key: 'operador_nome', width: 25 },
      { header: 'cpf', key: 'operador_cpf', width: 18 },
      { header: 'maquina', key: 'operador_maquina', width: 20 },
      { header: 'inicio', key: 'inicio', width: 12 },
      { header: 'termino', key: 'termino', width: 12 },
      { header: 'produto', key: 'produto', width: 18 },
      { header: 'peso', key: 'peso', width: 10 },
      { header: 'aparas', key: 'aparas', width: 10 },
      { header: 'obs', key: 'obs', width: 30 },
    ];

    // Estilo do cabeçalho
    sheet.getRow(1).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00B050' } // Verde
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Branco
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = borderStyle;
    });

    // Adicionar dados e somatórios
    let totalPeso = 0;
    let totalAparas = 0;

    dados.forEach(d => {
      const row = sheet.addRow(d);
      row.eachCell(cell => {
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      totalPeso += Number(d.peso || 0);
      totalAparas += Number(d.aparas || 0);
    });

    const ultimaLinha = sheet.rowCount + 2;

    // Total Geral
    sheet.mergeCells(`F${ultimaLinha}:G${ultimaLinha}`);
    sheet.getCell(`F${ultimaLinha}`).value = 'Total Geral:';
    sheet.getCell(`F${ultimaLinha}`).font = { bold: true };
    sheet.getCell(`F${ultimaLinha}`).alignment = { horizontal: 'right' };
    sheet.getCell(`F${ultimaLinha}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B050' }
    };
    sheet.getCell(`H${ultimaLinha}`).value = totalPeso;
    sheet.getCell(`H${ultimaLinha}`).font = { bold: true };
    sheet.getCell(`H${ultimaLinha}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF99' } // Amarelo claro
    };

    // Total Aparas
    sheet.mergeCells(`F${ultimaLinha + 1}:G${ultimaLinha + 1}`);
    sheet.getCell(`F${ultimaLinha + 1}`).value = 'Total de Aparas:';
    sheet.getCell(`F${ultimaLinha + 1}`).font = { bold: true };
    sheet.getCell(`F${ultimaLinha + 1}`).alignment = { horizontal: 'right' };
    sheet.getCell(`F${ultimaLinha + 1}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B050' }
    };
    sheet.getCell(`H${ultimaLinha + 1}`).value = totalAparas;
    sheet.getCell(`H${ultimaLinha + 1}`).font = { bold: true };
    sheet.getCell(`H${ultimaLinha + 1}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF99' }
    };

    // Enviar arquivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_extrusao.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar planilha.' });
  } finally {
    connection.release();
  }
});
////////////////////////


app.post('/relatorio/corte', autenticarJWT, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { data_inicio, data_fim } = req.body;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({ erro: 'data_inicio e data_fim são obrigatórios.' });
    }

    const query = `
      SELECT * FROM corte_ficha 
      WHERE preenchido_em BETWEEN ? AND ?
    `;
    const [dados] = await connection.query(query, [data_inicio, data_fim]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Corte');

    const borderStyle = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    // Colunas sem 'inicio' e 'termino'
    sheet.columns = [
      { header: 'Data', key: 'preenchido_em', width: 15 },
      { header: 'Nome', key: 'operador_nome', width: 25 },
      { header: 'CPF', key: 'operador_cpf', width: 18 },
      { header: 'Máquina', key: 'maquina', width: 20 },
      { header: 'Turno', key: 'turno', width: 18 },
      { header: 'Produto', key: 'produto', width: 18 },
      { header: 'Total', key: 'total', width: 10 },
      { header: 'Aparas', key: 'aparas', width: 10 },
      { header: 'Obs', key: 'obs', width: 30 },
    ];

    sheet.getRow(1).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00B050' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = borderStyle;
    });

    let totalPeso = 0;
    let totalAparas = 0;

    dados.forEach(d => {
      const row = sheet.addRow(d);
      row.eachCell(cell => {
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      totalPeso += Number(d.total || 0);
      totalAparas += Number(d.aparas || 0);
    });

    const ultimaLinha = sheet.rowCount + 1;

    sheet.mergeCells(`E${ultimaLinha}:F${ultimaLinha}`);
    const totalGeralCell = sheet.getCell(`E${ultimaLinha}`);
    totalGeralCell.value = 'Total Geral:';
    totalGeralCell.font = { bold: true };
    totalGeralCell.alignment = { horizontal: 'right' };
    totalGeralCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B050' },
    };
    totalGeralCell.border = borderStyle;

    const valorTotalCell = sheet.getCell(`G${ultimaLinha}`);
    valorTotalCell.value = totalPeso;
    valorTotalCell.font = { bold: true };
    valorTotalCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF99' },
    };
    valorTotalCell.border = borderStyle;

    sheet.mergeCells(`E${ultimaLinha + 1}:F${ultimaLinha + 1}`);
    const totalAparasCell = sheet.getCell(`E${ultimaLinha + 1}`);
    totalAparasCell.value = 'Total de Aparas:';
    totalAparasCell.font = { bold: true };
    totalAparasCell.alignment = { horizontal: 'right' };
    totalAparasCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B050' },
    };
    totalAparasCell.border = borderStyle;

    const valorAparasCell = sheet.getCell(`G${ultimaLinha + 1}`);
    valorAparasCell.value = totalAparas;
    valorAparasCell.font = { bold: true };
    valorAparasCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF99' },
    };
    valorAparasCell.border = borderStyle;

    sheet.autoFilter = {
      from: 'A1',
      to: 'I1',
    };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_corte.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar planilha.' });
  } finally {
    connection.release();
  }
});


//rota para relatorio de corte
app.get('/relatorio/corte', autenticarJWT, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const [dados] = await connection.query('SELECT * FROM corte_ficha');

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Extrusão');

    // Estilo de borda
    const borderStyle = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    // Cabeçalho
    sheet.columns = [
      { header: 'data', key: 'preenchido_em', width: 15 },
      { header: 'nome', key: 'operador_nome', width: 25 },
      { header: 'cpf', key: 'operador_cpf', width: 18 },
      { header: 'maquina', key: 'maquina', width: 20 },
      { header: 'turno', key: 'turno', width: 18 },
      { header: 'produto', key: 'sacola_dim', width: 18 },
      { header: 'total', key: 'total', width: 10 },
      { header: 'aparas', key: 'aparas', width: 10 },
      { header: 'obs', key: 'obs', width: 30 },
    ];

    // Estilo do cabeçalho
    sheet.getRow(1).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00B050' } // Verde
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // Branco
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = borderStyle;
    });

    // Adicionar dados e somatórios
    let totalPeso = 0;
    let totalAparas = 0;

    dados.forEach(d => {
      const row = sheet.addRow(d);
      row.eachCell(cell => {
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });
      totalPeso += Number(d.total || 0);
      totalAparas += Number(d.aparas || 0);
    });

    const ultimaLinha = sheet.rowCount + 2;

   // Total Geral (peso) na coluna G (total)
sheet.mergeCells(`F${ultimaLinha}:F${ultimaLinha}`);
sheet.getCell(`F${ultimaLinha}`).value = 'Total Geral:';
sheet.getCell(`F${ultimaLinha}`).font = { bold: true };
sheet.getCell(`F${ultimaLinha}`).alignment = { horizontal: 'right' };
sheet.getCell(`F${ultimaLinha}`).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF00B050' }
};
sheet.getCell(`G${ultimaLinha}`).value = totalPeso;
sheet.getCell(`G${ultimaLinha}`).font = { bold: true };
sheet.getCell(`G${ultimaLinha}`).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF99' }
};

// Total Aparas na coluna H
sheet.mergeCells(`F${ultimaLinha + 1}:F${ultimaLinha + 1}`);
sheet.getCell(`F${ultimaLinha + 1}`).value = 'Total de Aparas:';
sheet.getCell(`F${ultimaLinha + 1}`).font = { bold: true };
sheet.getCell(`F${ultimaLinha + 1}`).alignment = { horizontal: 'right' };
sheet.getCell(`F${ultimaLinha + 1}`).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF00B050' }
};
sheet.getCell(`G${ultimaLinha + 1}`).value = totalAparas;
sheet.getCell(`G${ultimaLinha + 1}`).font = { bold: true };
sheet.getCell(`G${ultimaLinha + 1}`).fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF99' }
};
    // Enviar arquivo
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_corte.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar planilha.' });
  } finally {
    connection.release();
  }
});

//relatorio de vendas geral
app.get('/relatorio/vendas', autenticarJWT, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const query = `SELECT * FROM vendas`;
    const [dados] = await connection.query(query);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Extrusão');

    const borderStyle = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    // Configurar colunas com largura e alinhamento padrão (texto à esquerda, números à direita)
    sheet.columns = [
      { header: 'Data', key: 'vendido_em', width: 15, style: { alignment: { horizontal: 'center' } } },
      { header: 'Cliente', key: 'cliente', width: 20, style: { alignment: { horizontal: 'left' } } },
      { header: 'Valor (R$)', key: 'valor', width: 15, style: { alignment: { horizontal: 'right' } } },
      { header: 'Peso (kg)', key: 'peso', width: 15, style: { alignment: { horizontal: 'right' } } },
      { header: 'Produto', key: 'produto', width: 25, style: { alignment: { horizontal: 'left' } } },
    ];

    // Estilo cabeçalho
    sheet.getRow(1).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' }, // azul escuro
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = borderStyle;
    });

    let totalPeso = 0;
    let totalValor = 0;
    const totaisPorProduto = {};

    dados.forEach(d => {
      let pesoNum = Number(String(d.peso).replace(',', '.')) || 0;
      let valorNum = Number(String(d.valor).replace(',', '.')) || 0;

      const rowData = {
        ...d,
        peso: pesoNum,
        valor: valorNum,
      };

      const row = sheet.addRow(rowData);

      row.getCell('peso').numFmt = '#,##0.00'; // formato numérico com 2 decimais
      row.getCell('valor').numFmt = '#,##0.00';

      row.eachCell(cell => {
        cell.border = borderStyle;
        // Alinhar texto e números apropriadamente
        if (cell.col === 3 || cell.col === 4) { // valor e peso
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });

      totalPeso += pesoNum;
      totalValor += valorNum;

      const produto = d.produto || 'Não informado';
      if (!totaisPorProduto[produto]) {
        totaisPorProduto[produto] = { peso: 0, valor: 0 };
      }
      totaisPorProduto[produto].peso += pesoNum;
      totaisPorProduto[produto].valor += valorNum;
    });

    // Linha em branco para separar
    sheet.addRow([]);

    const linhaTotalGeral = sheet.rowCount + 1;

    // Total Geral título
    sheet.mergeCells(`A${linhaTotalGeral}:B${linhaTotalGeral}`);
    const celTotalLabel = sheet.getCell(`A${linhaTotalGeral}`);
    celTotalLabel.value = 'Total Geral';
    celTotalLabel.font = { bold: true, size: 12 };
    celTotalLabel.alignment = { horizontal: 'right', vertical: 'middle' };
    celTotalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4BACC6' } };
    celTotalLabel.border = borderStyle;

    // Total Peso
    const celTotalPeso = sheet.getCell(`C${linhaTotalGeral}`);
    celTotalPeso.value = totalPeso;
    celTotalPeso.numFmt = '#,##0.00';
    celTotalPeso.font = { bold: true };
    celTotalPeso.alignment = { horizontal: 'right', vertical: 'middle' };
    celTotalPeso.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    celTotalPeso.border = borderStyle;

    // Total Valor
    const celTotalValor = sheet.getCell(`D${linhaTotalGeral}`);
    celTotalValor.value = totalValor;
    celTotalValor.numFmt = '#,##0.00';
    celTotalValor.font = { bold: true };
    celTotalValor.alignment = { horizontal: 'right', vertical: 'middle' };
    celTotalValor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
    celTotalValor.border = borderStyle;

    // Coluna Produto do total geral vazia
    sheet.getCell(`E${linhaTotalGeral}`).border = borderStyle;

    // Espaço antes do resumo por produto
    sheet.addRow([]);

    let linhaResumo = sheet.rowCount + 1;

    // Título Totais por Produto
    sheet.mergeCells(`A${linhaResumo}:E${linhaResumo}`);
    const celResumoTitle = sheet.getCell(`A${linhaResumo}`);
    celResumoTitle.value = 'Totais por Produto';
    celResumoTitle.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    celResumoTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8064A2' } };
    celResumoTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    celResumoTitle.border = borderStyle;

    linhaResumo++;
    // Cabeçalhos do resumo
    sheet.getRow(linhaResumo).values = ['Produto', 'Total Peso', 'Total Valor'];
    ['A', 'B', 'C'].forEach(col => {
      const cel = sheet.getCell(`${col}${linhaResumo}`);
      cel.font = { bold: true };
      cel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
      cel.alignment = { horizontal: col === 'A' ? 'left' : 'right', vertical: 'middle' };
      cel.border = borderStyle;
    });

    Object.entries(totaisPorProduto).forEach(([produto, total], i) => {
      const linhaAtual = linhaResumo + 1 + i;
      sheet.getCell(`A${linhaAtual}`).value = produto;
      sheet.getCell(`B${linhaAtual}`).value = total.peso;
      sheet.getCell(`C${linhaAtual}`).value = total.valor;

      sheet.getCell(`B${linhaAtual}`).numFmt = '#,##0.00';
      sheet.getCell(`C${linhaAtual}`).numFmt = '#,##0.00';

      ['A', 'B', 'C'].forEach(col => {
        const cell = sheet.getCell(`${col}${linhaAtual}`);
        cell.border = borderStyle;
        cell.alignment = col === 'A' ? { horizontal: 'left' } : { horizontal: 'right' };
      });
    });

    // Ajuste final para altura das linhas (opcional)
    sheet.eachRow(row => {
      row.height = 20;
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_extrusao.xlsx');
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar planilha.' });
  } finally {
    connection.release();
  }
});



//relatorio de vendas por periodo
app.post('/relatorio/vendas/periodo', autenticarJWT, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { data_inicio, data_fim } = req.body;

    if (!data_inicio || !data_fim) {
      return res.status(400).json({ erro: 'data_inicio e data_fim são obrigatórios.' });
    }

    const query = `
      SELECT * FROM vendas
      WHERE vendido_em BETWEEN ? AND ?
    `;
    const [dados] = await connection.query(query, [data_inicio, data_fim]);

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Extrusão');

    const borderStyle = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    sheet.columns = [
      { header: 'Data', key: 'vendido_em', width: 15 },
      { header: 'Cliente', key: 'cliente', width: 18 },
      { header: 'Valor', key: 'valor', width: 20 },
      { header: 'Peso', key: 'peso', width: 12 },
      { header: 'Produto', key: 'produto', width: 18 },
    ];

    sheet.getRow(1).eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00B050' }
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = borderStyle;
    });

    let totalPeso = 0;
    const totaisPorProduto = {};

    dados.forEach(d => {
      const row = sheet.addRow(d);
      row.eachCell(cell => {
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      });

      totalPeso += Number(d.peso || 0);

      const produto = d.produto || 'Não informado';
      if (!totaisPorProduto[produto]) {
        totaisPorProduto[produto] = { peso: 0, valor: 0 };
      }
      totaisPorProduto[produto].peso += Number(d.peso || 0);
      totaisPorProduto[produto].valor += Number(d.valor || 0);
    });

    const ultimaLinha = sheet.rowCount + 2;

    // Total Geral
    sheet.mergeCells(`F${ultimaLinha}:G${ultimaLinha}`);
    sheet.getCell(`F${ultimaLinha}`).value = 'Total Geral:';
    sheet.getCell(`F${ultimaLinha}`).font = { bold: true };
    sheet.getCell(`F${ultimaLinha}`).alignment = { horizontal: 'right' };
    sheet.getCell(`F${ultimaLinha}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00B050' }
    };
    sheet.getCell(`H${ultimaLinha}`).value = totalPeso;
    sheet.getCell(`H${ultimaLinha}`).font = { bold: true };
    sheet.getCell(`H${ultimaLinha}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFFF99' }
    };

    // Totais por Produto
    let linhaResumo = ultimaLinha + 3;

    sheet.mergeCells(`F${linhaResumo}:H${linhaResumo}`);
    sheet.getCell(`F${linhaResumo}`).value = 'Totais por Produto';
    sheet.getCell(`F${linhaResumo}`).font = { bold: true };
    sheet.getCell(`F${linhaResumo}`).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    sheet.getCell(`F${linhaResumo}`).alignment = { horizontal: 'center' };

    linhaResumo++;
    sheet.getCell(`F${linhaResumo}`).value = 'Produto';
    sheet.getCell(`G${linhaResumo}`).value = 'Total Peso';
    sheet.getCell(`H${linhaResumo}`).value = 'Total Valor';
    ['F', 'G', 'H'].forEach(col => {
      const cell = sheet.getCell(`${col}${linhaResumo}`);
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFBDD7EE' }
      };
      cell.alignment = { horizontal: 'center' };
      cell.border = borderStyle;
    });

    Object.entries(totaisPorProduto).forEach(([produto, total], i) => {
      const linhaAtual = linhaResumo + 1 + i;
      sheet.getCell(`F${linhaAtual}`).value = produto;
      sheet.getCell(`G${linhaAtual}`).value = total.peso;
      sheet.getCell(`H${linhaAtual}`).value = total.valor;

      ['F', 'G', 'H'].forEach(col => {
        const cell = sheet.getCell(`${col}${linhaAtual}`);
        cell.border = borderStyle;
        cell.alignment = { horizontal: 'left' };
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_extrusao.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar planilha.' });
  } finally {
    connection.release();
  }
});
// iniciar aplicação
app.listen(3000, () => console.log('Servidor rodando na porta 3000'));