/**
 * Exemplo de como usar a API de NFe programaticamente
 */

// Iniciar o servidor
const app = require('./src/app');

// Função de exemplo para interceptar a URL de uma NFe
async function interceptarUrlNFe(chaveAcesso) {
  try {
    // Importar axios para fazer requisições HTTP
    const axios = require('axios');
    
    // Configuração da porta do servidor
    const PORT = process.env.PORT || 3002;
    
    console.log(`Interceptando URL para chave: ${chaveAcesso}`);
    
    // Fazer requisição para o endpoint
    const response = await axios.get(`http://localhost:${PORT}/api/nfe/interceptar-url/${chaveAcesso}`);
    
    // Verificar se a requisição foi bem-sucedida
    if (response.data && response.data.success && response.data.url) {
      console.log('URL interceptada com sucesso:');
      console.log(response.data.url);
      return response.data.url;
    } else {
      console.error('Erro ao interceptar URL:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Erro na requisição:', error.message);
    return null;
  }
}

// Exemplo de uso
const chaveExemplo = '51250209608375000103550010000047211000141634';

// Chamar a função de exemplo (só descomentar quando for usar)
// interceptarUrlNFe(chaveExemplo);

module.exports = {
  interceptarUrlNFe
}; 