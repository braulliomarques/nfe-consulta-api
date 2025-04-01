/**
 * Exemplo de como usar a API de NFe programaticamente
 */

// Iniciar o servidor
const app = require('./src/app');

// Função de exemplo para interceptar a URL de uma NFe
async function interceptarUrlNFe(chaveAcesso, token2captcha = null) {
  try {
    // Importar axios para fazer requisições HTTP
    const axios = require('axios');
    
    // Configuração da porta do servidor
    const PORT = process.env.PORT || 3002;
    
    console.log(`Interceptando URL para chave: ${chaveAcesso}`);
    
    // Preparar dados da requisição
    const requestData = {
      chave: chaveAcesso
    };
    
    // Adicionar token 2captcha se fornecido
    if (token2captcha) {
      requestData.token2captcha = token2captcha;
      console.log('Usando token 2captcha fornecido');
    }
    
    // Fazer requisição para o endpoint
    const response = await axios.post(
      `http://localhost:${PORT}/api/nfe/interceptar-url`, 
      requestData
    );
    
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
const token2CaptchaExemplo = 'seu_token_aqui'; // Substitua pelo seu token 2captcha

// Chamar a função de exemplo (só descomentar quando for usar)
// interceptarUrlNFe(chaveExemplo, token2CaptchaExemplo);

module.exports = {
  interceptarUrlNFe
}; 