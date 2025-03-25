const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');
const nfeRoutes = require('../routes/nfe');
const batchNfeRoutes = require('../routes/batch-nfe');

const app = express();
const PORT = process.env.PORT || 3002;

// Middlewares
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Rotas
app.use('/api/nfe', nfeRoutes);
app.use('/api/batch', batchNfeRoutes);

// Rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acessível na rede local em: http://0.0.0.0:${PORT}`);
  console.log('Para acessar de outros dispositivos, use o IP da máquina');
});

module.exports = app;