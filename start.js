/**
 * Script para iniciar o servidor da API
 */

console.log('Iniciando servidor da API de NFe...');

// Importar e iniciar o servidor
const app = require('./src/app');

console.log(`API pronta para uso! 
Endpoints disponíveis:
- GET /api/nfe/interceptar-url/:chave
- POST /api/nfe/interceptar-url

Para testar a API, você pode executar:
node test-api.js CHAVE_NFE
`); 