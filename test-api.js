/**
 * Script para testar a API de interceptação de URL de NFe
 * 
 * Uso: node test-api.js CHAVE_NFE
 */

const axios = require('axios');

// Obter a chave de acesso como argumento de linha de comando ou usar chave padrão
const chaveNFe = process.argv[2] || '51250209608375000103550010000047311000141932';

// URL da API
const apiUrl = `http://177.23.191.86:3002/api/nfe/interceptar-url/${chaveNFe}`;

console.log(`\n========================================`);
console.log(`Testando API de interceptação de URL NFe`);
console.log(`========================================`);
console.log(`Chave NFe: ${chaveNFe}`);
console.log(`Endpoint: ${apiUrl}`);
console.log(`\nIniciando requisição...\n`);

// Fazer a requisição para a API
axios.get(apiUrl)
  .then(response => {
    console.log('✅ SUCESSO:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.url) {
      console.log(`\n📋 URL interceptada com sucesso!\n`);
    }
  })
  .catch(error => {
    console.error('❌ ERRO:');
    
    if (error.response) {
      // A requisição foi feita e o servidor respondeu com status fora do intervalo 2xx
      console.error(`Status: ${error.response.status}`);
      console.error('Resposta:');
      console.error(JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      console.error('Erro: Sem resposta do servidor. Verifique se a API está rodando.');
    } else {
      // Erro na configuração da requisição
      console.error(`Erro: ${error.message}`);
    }
  }); 