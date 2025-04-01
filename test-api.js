const axios = require('axios');

async function interceptarUrlNFe(chaveAcesso, token2captcha = null) {
  try {
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
      
      // Mostrar dados da NFe, se disponíveis
      if (response.data.dadosNFe) {
        console.log('\nDados da NFe extraídos:');
        console.log('------------------------');
        
        const dados = response.data.dadosNFe;
        if (dados.encontrados) {
          console.log(`Emitente: ${dados.emitente}`);
          console.log(`Valor Total: ${dados.valor}`);
          
          // Se houver mais dados detalhados
          if (dados.detalhes) {
            console.log('\nDetalhes completos:');
            console.log(JSON.stringify(dados.detalhes, null, 2));
          }
        } else {
          console.log('Não foi possível extrair dados detalhados da NFe.');
        }
      }
      
      return {
        url: response.data.url,
        dadosNFe: response.data.dadosNFe
      };
    } else {
      console.error('Erro ao interceptar URL:', response.data);
      return null;
    }
  } catch (error) {
    console.error('Erro na requisição:', error.message);
    return null;
  }
}

// Executar a função com os parâmetros fornecidos
interceptarUrlNFe('51240301624149000457550010001270781003812344', 'f623a43b10acb451a2c276858c0e5f7b')
  .then(resultado => {
    if (resultado) {
      console.log('\nProcessamento concluído com sucesso.');
    } else {
      console.log('\nNão foi possível obter a URL.');
    }
  });
