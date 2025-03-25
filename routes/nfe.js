const express = require('express');
const router = express.Router();
const nfeService = require('../services/nfe-service');
const { Solver } = require('@2captcha/captcha-solver');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');
const axios = require('axios');
const https = require('https');
require('dotenv').config();

const apiKey = process.env.CAPTCHA_API_KEY;
const solver = new Solver(apiKey);

// Diretório para arquivos temporários
const TEMP_DIR = './temp';
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Função para realizar o download da URL interceptada usando curl
 * @param {string} url - URL para download
 * @param {string} chaveAcesso - Chave de acesso da NFe
 * @returns {Promise<object>} - Resultado do download
 */
async function downloadXmlFromUrl(url, chaveAcesso) {
  try {
    console.log(`Iniciando download automático da URL usando curl: ${url}`);
    
    // Verificar caminhos dos certificados SSL
    const certPath = path.resolve(process.cwd(), 'cert.pem');
    const keyPath = path.resolve(process.cwd(), 'key.pem');
    
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      // Se não existir, converte o certificado PFX para PEM
      throw new Error('Certificados PEM não encontrados. Execute a conversão primeiro.');
    }
    
    // Nome do arquivo baseado na chave de acesso
    const timestamp = new Date().toISOString().replace(/[:]/g, '-');
    const fileName = `NFe-${chaveAcesso}-${timestamp}.xml`;
    const filePath = path.join(TEMP_DIR, fileName);
    
    // Preparar script curl
    const curlScriptPath = path.join(TEMP_DIR, `curl-download-${timestamp}.sh`);
    
    // Criar script curl com certificados e URL
    const curlScript = `#!/bin/bash

# Script gerado automaticamente para download de XML da NF-e
# Data: ${new Date().toLocaleString()}
# Chave de acesso: ${chaveAcesso}

curl -L \
  --cert "${certPath}" \
  --key "${keyPath}" \
  --cert-type PEM \
  --key-type PEM \
  --insecure \
  --max-redirs 100 \
  --location-trusted \
  --connect-timeout 120 \
  --max-time 300 \
  --retry 5 \
  --retry-delay 2 \
  -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" \
  -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8" \
  -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" \
  -H "Cache-Control: no-cache" \
  -H "Pragma: no-cache" \
  -o "${filePath}" \
  "${url}"

# Verificar resultado
if [ -f "${filePath}" ]; then
  echo "Download concluído com sucesso: ${filePath}"
  echo "Tamanho do arquivo: $(stat -c%s "${filePath}") bytes"
  exit 0
else
  echo "Erro ao baixar o arquivo"
  exit 1
fi`;
    
    // Salvar o script
    fs.writeFileSync(curlScriptPath, curlScript);
    fs.chmodSync(curlScriptPath, '755'); // Tornar executável
    
    console.log(`Script curl salvo em: ${curlScriptPath}`);
    
    // Executar o comando curl diretamente
    return new Promise((resolve, reject) => {
      try {
        const { execSync } = require('child_process');
        console.log('Executando comando curl diretamente...');
        
        // Usar execSync para ter mais controle e evitar problemas de path
        // Modificado para usar --cert-type PEM em vez de tentar carregar PKCS12
        const comando = `curl -L \
          --cert "${certPath}" \
          --key "${keyPath}" \
          --cert-type PEM \
          --key-type PEM \
          --insecure \
          --max-redirs 100 \
          --location-trusted \
          --connect-timeout 120 \
          --max-time 300 \
          --retry 5 \
          --retry-delay 2 \
          -A "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36" \
          -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8" \
          -H "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" \
          -H "Cache-Control: no-cache" \
          -H "Pragma: no-cache" \
          -o "${filePath}" \
          "${url}"`;
          
        console.log(`Comando curl a ser executado:\n${comando}`);
        
        // Executar o comando curl diretamente
        const stdout = execSync(comando, { encoding: 'utf8' });
        console.log(`Resultado do curl: ${stdout}`);
        
        // Verificar se o arquivo foi salvo
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          console.log(`Arquivo baixado com sucesso: ${filePath} (${stats.size} bytes)`);
          
          // Verificar se o arquivo parece um XML
          try {
            const conteudo = fs.readFileSync(filePath, 'utf8').slice(0, 500);
            const isXml = conteudo.includes('<?xml');
            
            return resolve({
              success: true,
              filePath,
              fileName: path.basename(filePath),
              fileSize: stats.size,
              isXml: isXml
            });
          } catch (readError) {
            console.error(`Erro ao ler o conteúdo do arquivo: ${readError.message}`);
            // Mesmo com erro de leitura, considerar sucesso se o arquivo existe
            return resolve({
              success: true,
              filePath,
              fileName: path.basename(filePath),
              fileSize: stats.size,
              isXml: false
            });
          }
        } else {
          return reject(new Error('Arquivo não foi baixado pelo curl'));
        }
      } catch (error) {
        console.error(`Erro ao executar comando curl: ${error.message}`);
        return reject(error);
      }
    });
    
  } catch (error) {
    console.error(`Erro no download automático da URL:`, error);
    throw error;
  }
}

// Validar formato da chave de acesso da NF-e
function validarChaveAcesso(chave) {
  // Remove caracteres não numéricos
  chave = chave.replace(/[^\d]+/g, '');
  
  // Chave de acesso deve ter 44 dígitos
  if (chave.length !== 44) {
    return false;
  }
  
  return true;
}

// Rota para verificar saldo da API 2Captcha
router.get('/saldo', async (req, res) => {
  try {
    const saldo = await solver.balance();
    res.json({ saldo });
  } catch (error) {
    console.error('Erro ao verificar saldo:', error);
    res.status(500).json({ error: 'Erro ao verificar saldo', message: error.message });
  }
});

// Rota para consulta de NF-e usando Puppeteer
router.post('/consulta', async (req, res) => {
  try {
    const { chaveAcesso } = req.body;
    
    // Validar chave de acesso
    if (!chaveAcesso) {
      return res.status(400).json({ error: 'Chave de acesso não fornecida' });
    }
    
    if (!validarChaveAcesso(chaveAcesso)) {
      return res.status(400).json({ error: 'Chave de acesso inválida. Deve conter 44 dígitos numéricos.' });
    }

    // Configuração do certificado digital
    const certificado = {
      path: path.resolve(process.cwd(), '09608375000103.pfx'),
      senha: 'Labor@123'
    };
    
    console.log(`Caminho completo do certificado: ${certificado.path}`);
    
    // Usar o serviço para consultar a NF-e - garantir que a chave esteja limpa e correta
    const chaveAcessoLimpa = chaveAcesso.replace(/[^\d]+/g, '');
    console.log(`Consultando NFe com chave limpa: ${chaveAcessoLimpa}`);
    
    const resultado = await nfeService.consultarNFe(
      chaveAcessoLimpa,
      certificado,
      { forceChave: true } // Adicionar opção para forçar uso da chave específica
    );
    
    // Retornar dados estruturados e informações para diagnóstico
    res.json({ 
      success: true, 
      dados: resultado.dados,
      url: resultado.url,
      htmlSalvoEm: resultado.filePath,
      chaveConsultada: chaveAcesso
    });
    
  } catch (error) {
    console.error('Erro ao processar consulta de NF-e:', error);
    res.status(500).json({ 
      error: 'Erro ao processar consulta', 
      message: error.message 
    });
  }
});

// Rota para download de XML de NF-e
router.post('/download-xml', async (req, res) => {
  try {
    const { chaveAcesso } = req.body;
    
    // Validar chave de acesso
    if (!chaveAcesso) {
      return res.status(400).json({ error: 'Chave de acesso não fornecida' });
    }
    
    if (!validarChaveAcesso(chaveAcesso)) {
      return res.status(400).json({ 
        success: false,
        error: 'Chave de acesso inválida', 
        message: 'A chave de acesso deve conter 44 dígitos numéricos.'
      });
    }

    // Certificar-se de que o certificado PEM existe
    const certPath = path.resolve(process.cwd(), 'cert.pem');
    const keyPath = path.resolve(process.cwd(), 'key.pem');
    
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      // Se não existir, converte o certificado PFX para PEM
      try {
        console.log('Convertendo certificado PFX para PEM...');
        execSync('node convert-forge.js', { stdio: 'inherit' });
      } catch (error) {
        return res.status(500).json({
          success: false,
          error: 'Erro na conversão do certificado',
          message: 'Não foi possível converter o certificado PFX para PEM. ' + error.message
        });
      }
    }
    
    try {
      console.log(`Iniciando fluxo completo para download da NFe: ${chaveAcesso}...`);
      
      // Usar o script consulta-e-download.js para o fluxo completo de autenticação e download
      const scriptPath = path.resolve(process.cwd(), 'consulta-e-download.js');
      
      // Verificar se o script existe
      if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({
          success: false,
          error: 'Script não encontrado',
          message: 'O script consulta-e-download.js não foi encontrado. Verifique a instalação.'
        });
      }
      
      // Criar um objeto para armazenar eventos do processo
      const eventos = [];
      let progresso = 0;
      
      // Executar o script e capturar a saída em tempo real
      const childProcess = require('child_process').spawn('node', [scriptPath, chaveAcesso], {
        cwd: process.cwd()
      });
      
      // Função para enviar evento SSE
      function enviarEvento(tipo, dados = {}) {
        res.write(`data: ${JSON.stringify({ tipo, dados, progresso })}\n\n`);
        
        // Adicionar um registro de log
        console.log(`[NFe ${chaveAcesso}] Evento: ${tipo}, Progresso: ${progresso}%, Dados:`, dados);
      }
      
      // Manter compatibilidade com código existente
      const sendSSE = (req, res, data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      
      // Função para enviar erro e encerrar
      function enviarErro(descricao, erro = null, dados = {}) {
        // Adicionar informações de debug
        let dadosErro = {
          descricao,
          erro: erro || 'erro_generico',
          ...dados
        };
        
        // Se for erro de botão não encontrado, adicionar mensagem específica e tratamento
        if (descricao.includes('botão de download') || 
            descricao.includes('não foi possível encontrar o botão') || 
            descricao.includes('elemento não encontrado')) {
          dadosErro.erro = 'captcha_ou_elemento';
          dadosErro.reprocessamentoRecomendado = true;
          console.error(`[ERRO] Erro de captcha ou elemento não encontrado para ${chaveAcesso}:`, descricao);
        }
        
        enviarEvento('erro', dadosErro);
        res.end();
      }
      
      // Iniciar SSE (Server-Sent Events) para streaming de eventos
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      // Enviar primeiro evento
      sendSSE(req, res, {
        tipo: 'inicio',
        mensagem: `Iniciando processamento para chave: ${chaveAcesso}`,
        progresso: 0
      });
      
      // Buffer para acumular dados da saída
      let stdoutBuffer = '';
      let resultadoJSON = null;
      
      // Capturar saída em tempo real
      childProcess.stdout.on('data', (data) => {
        // Acumular dados no buffer
        const output = data.toString();
        stdoutBuffer += output;
        
        // Procurar por eventos JSON na saída
        const lines = output.split('\n');
        
        for (const line of lines) {
          // Detectar erros específicos de botão de download não encontrado
          if (line.includes('botão de download não encontrado') || 
              line.includes('Botão de download não encontrado') ||
              line.includes('"erro":"botao_download_nao_encontrado"')) {
            console.log(`[ALERTA] Detectado erro de botão não encontrado: ${line}`);
            
            // Extrair informações do JSON se disponível
            let htmlFilePath = null;
            try {
              if (line.includes('{"event":')) {
                const match = line.match(/\{"event":\s*"([^"]+)",\s*"data":\s*(\{.+\})\}/);
                if (match && match.length === 3) {
                  const eventData = JSON.parse(match[2]);
                  if (eventData.html) {
                    htmlFilePath = eventData.html;
                  }
                }
              }
            } catch (jsonError) {
              console.error('Erro ao extrair JSON do erro de botão:', jsonError);
            }
            
            // Se não conseguiu extrair o caminho do HTML, tentar criar um com o buffer
            if (!htmlFilePath) {
              try {
                // Capturar o HTML da página para diagnóstico
                const htmlFilePath = path.join(TEMP_DIR, `erro-botao-${chaveAcesso}-${Date.now()}.html`);
                
                // Se tivermos o conteúdo HTML disponível, salvar para análise
                if (stdoutBuffer.includes('<html') && stdoutBuffer.includes('</html>')) {
                  const htmlContent = stdoutBuffer.substring(
                    stdoutBuffer.indexOf('<html'),
                    stdoutBuffer.lastIndexOf('</html>') + 7
                  );
                  
                  fs.writeFileSync(htmlFilePath, htmlContent);
                  console.log(`[DEBUG] HTML da página com erro de botão salvo em: ${htmlFilePath}`);
                }
              } catch (htmlError) {
                console.error('Erro ao salvar HTML para diagnóstico:', htmlError);
              }
            }
            
            // Enviar erro específico para o cliente
            enviarErro(
              `Erro: Botão de download não encontrado. Possível problema de captcha ou layout da página.`, 
              'botao_download_nao_encontrado',
              { 
                html: htmlFilePath,
                reprocessamentoRecomendado: true
              }
            );
            return;
          }
          
          // Detectar outros erros genéricos de captcha e elementos
          if (line.includes('não foi possível encontrar o botão') || 
              line.includes('elemento não encontrado') ||
              line.includes('captcha não resolvido')) {
            // Capturar o HTML da página para diagnóstico
            const htmlFilePath = path.join(TEMP_DIR, `erro-${chaveAcesso}-${Date.now()}.html`);
            
            try {
              // Se tivermos o conteúdo HTML disponível, salvar para análise
              if (stdoutBuffer.includes('<html') && stdoutBuffer.includes('</html>')) {
                const htmlContent = stdoutBuffer.substring(
                  stdoutBuffer.indexOf('<html'),
                  stdoutBuffer.lastIndexOf('</html>') + 7
                );
                
                fs.writeFileSync(htmlFilePath, htmlContent);
                console.log(`[DEBUG] HTML da página com erro salvo em: ${htmlFilePath}`);
                
                // Enviar erro com referência ao HTML
                enviarErro(
                  `Erro no processamento: ${line}`, 
                  'captcha_ou_elemento',
                  { 
                    html: htmlFilePath,
                    reprocessamentoRecomendado: true 
                  }
                );
                return;
              }
            } catch (error) {
              console.error('Erro ao salvar HTML para diagnóstico:', error);
            }
          }
          
          // Tentar extrair eventos JSON
          if (line.includes('{"event":')) {
            try {
              // Extrair o JSON do formato {"event": "tipo", "data": {...}}
              const match = line.match(/\{"event":\s*"([^"]+)",\s*"data":\s*(\{.+\})\}/);
              
              if (match && match.length === 3) {
                const eventType = match[1];
                const eventData = JSON.parse(match[2]);
                
                // Armazenar evento
                eventos.push({ tipo: eventType, data: eventData });
                
                // Atualizar progresso se for evento de etapa
                if (eventType === 'etapa' && typeof eventData.porcentagem === 'number') {
                  progresso = eventData.porcentagem;
                }

                // Se for evento de download, apenas enviar a URL para o cliente
                if (eventType === 'download' && eventData.url) {
                  console.log(`URL de download interceptada: ${eventData.url}`);
                  
                  // Enviar a URL diretamente para o cliente
                  sendSSE(req, res, {
                    tipo: 'download_url',
                    dados: {
                      descricao: 'URL para download do XML disponível',
                      url: eventData.url,
                      chaveAcesso: chaveAcesso
                    },
                    progresso: progresso
                  });
                  
                  console.log('URL de download enviada para o cliente');
                  
                  // O download automático foi removido, apenas informamos o usuário da URL disponibilizada
                }
                
                // Enviar evento para o cliente em tempo real
                sendSSE(req, res, {
                  tipo: eventType,
                  dados: eventData,
                  progresso: progresso
                });
              }
            } catch (e) {
              console.log('Erro ao processar evento JSON:', e);
            }
          } 
          // Capturar o resultado final
          else if (line.includes('"success":')) {
            try {
              resultadoJSON = JSON.parse(line);
              // Não enviamos o resultado aqui, ele será processado ao final
            } catch (e) {
              console.log('Erro ao processar JSON de resultado:', e);
            }
          }
        }
      });
      
      // Esperar pelo final da execução
      const result = await new Promise((resolve, reject) => {
        // Capturar erros
        childProcess.stderr.on('data', (data) => {
          console.error(`Erro no processo: ${data}`);
        });
        
        // Evento de finalização
        childProcess.on('close', (code) => {
          if (code === 0) {
            // Processo bem-sucedido
            resolve(stdoutBuffer);
          } else {
            // Processo falhou
            reject(new Error(`Processo falhou com código: ${code}`));
          }
        });
        
        // Timeout de segurança (5 minutos)
        setTimeout(() => {
          childProcess.kill();
          reject(new Error('Timeout de execução excedido (5 minutos)'));
        }, 5 * 60 * 1000);
      });
      
      // Verificar se a conexão SSE ainda está aberta antes de tentar enviar mais eventos
      if (!res.writableEnded && !res.finished) {
        // Enviar evento de finalização
        try {
          // Verificar se tivemos sucesso na obtenção do XML ou se o processamento foi incompleto
          if (!resultadoJSON || !resultadoJSON.success) {
            // Se não encontramos nenhum resultado ou não tivemos sucesso, enviar evento de processamento incompleto
            sendSSE(req, res, {
              tipo: 'erro',
              dados: {
                descricao: 'Processamento não foi concluído corretamente',
                erro: 'processamento_incompleto',
                reprocessamentoRecomendado: true
              },
              progresso: 100
            });
          } else {
            sendSSE(req, res, {
              tipo: 'fim',
              mensagem: 'Processamento concluído',
              progresso: 100
            });
          }
          
          // Fechar o stream SSE
          res.end();
        } catch (sseError) {
          console.error('Erro ao finalizar stream SSE:', sseError);
        }
      } else {
        console.log('Stream SSE já foi finalizado, ignorando envio de evento de finalização');
      }
      
      // O cliente já recebeu os eventos em tempo real, não precisamos retornar nada adicional
      // Mas registramos o resultado final para uso interno
      console.log(`Processamento concluído para a chave ${chaveAcesso} com ${eventos.length} eventos`);
      
      // Alternativa: se quiser mesmo assim capturar o resultado final do JSON:
      if (resultadoJSON) {
        console.log("Resultado final:", resultadoJSON);
      }
      
    } catch (error) {
      console.error('Erro ao baixar XML:', error);
      
      // Se o script falhar completamente, tentar com o método anterior como fallback
      try {
        // Não tentaremos mais fazer download automaticamente
        // Apenas verificamos se a resposta já foi enviada antes de tentar enviar um evento de falha
        if (!res.headersSent) {
          // Enviar evento de falha para o cliente
          sendSSE(req, res, {
            tipo: 'erro',
            dados: {
              descricao: 'Falha no download automático',
              erro: error.message,
              detalhe: 'Por favor, use a URL fornecida para baixar manualmente'
            },
            progresso: progresso
          });
        } else {
          console.log('Cabeçalhos já enviados, não é possível enviar evento de erro');
        }
      } catch (fallbackError) {
        console.error('Erro ao enviar evento de erro:', fallbackError);
      }
      
      // Se chegou aqui, ambos os métodos falharam
      // Verificar se a resposta já foi enviada antes de tentar enviar novamente
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          error: 'Erro ao baixar XML',
          message: error.message,
          detalhes: 'Todos os métodos de download falharam'
        });
      } else {
        console.error('Tentativa de enviar resposta após cabeçalhos já enviados:', error.message);
      }
    }
  } catch (error) {
    console.error('Erro ao processar download de XML:', error);
    // Verificar se a resposta já foi enviada antes de tentar enviar novamente
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Erro ao processar download',
        message: error.message
      });
    } else {
      console.error('Tentativa de enviar resposta após cabeçalhos já enviados:', error.message);
    }
  }
});

// Rota para download de arquivo individual
router.get('/download', (req, res) => {
  try {
    const { file } = req.query;
    
    if (!file) {
      return res.status(400).json({ error: 'Parâmetro file não fornecido' });
    }
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(file)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }
    
    // Extrair o nome do arquivo do caminho completo
    const fileName = path.basename(file);
    
    // Configurar headers e enviar o arquivo
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/xml');
    
    // Criar stream de leitura e enviar para o cliente
    const fileStream = fs.createReadStream(file);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Erro ao enviar arquivo para download:', error);
    res.status(500).json({ error: 'Erro ao processar download', message: error.message });
  }
});

// Rota para download em lote (ZIP)
router.post('/download-batch', async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: 'Lista de arquivos não fornecida ou vazia' });
    }
    
    // Criar um arquivo ZIP
    const zip = new AdmZip();
    
    // Adicionar cada arquivo ao ZIP
    const addedFiles = [];
    
    files.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        const fileName = path.basename(filePath);
        zip.addLocalFile(filePath);
        addedFiles.push(fileName);
      }
    });
    
    if (addedFiles.length === 0) {
      return res.status(404).json({ error: 'Nenhum arquivo válido encontrado' });
    }
    
    // Gerar o arquivo ZIP
    const zipBuffer = zip.toBuffer();
    
    // Configurar headers e enviar o ZIP
    res.setHeader('Content-Disposition', 'attachment; filename="nfe-batch.zip"');
    res.setHeader('Content-Type', 'application/zip');
    
    // Enviar o ZIP como resposta
    res.send(zipBuffer);
  } catch (error) {
    console.error('Erro ao gerar arquivo ZIP:', error);
    res.status(500).json({ error: 'Erro ao gerar arquivo ZIP', message: error.message });
  }
});

// Rota para interceptar a URL de download e retorná-la como JSON
router.get('/interceptar-url/:chave', async (req, res) => {
  try {
    const { chave } = req.params;
    
    // Validar chave de acesso
    if (!chave) {
      return res.status(400).json({ 
        success: false, 
        error: 'Chave de acesso não fornecida' 
      });
    }
    
    if (!validarChaveAcesso(chave)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Chave de acesso inválida. Deve conter 44 dígitos numéricos.' 
      });
    }
    
    console.log(`Iniciando interceptação de URL para a chave: ${chave}...`);
    
    // Usar o script consulta-e-download.js para o fluxo completo de autenticação e download
    const scriptPath = path.resolve(process.cwd(), 'consulta-e-download.js');
    
    // Verificar se o script existe
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({
        success: false,
        error: 'Script não encontrado',
        message: 'O script consulta-e-download.js não foi encontrado. Verifique a instalação.'
      });
    }
    
    // Variável para controlar se a resposta já foi enviada
    let resEnviada = false;
    
    // Executar o script e capturar a saída
    const childProcess = require('child_process').spawn('node', [scriptPath, chave], {
      cwd: process.cwd()
    });
    
    let stdoutBuffer = '';
    let downloadUrl = null;
    
    // Capturar saída em tempo real
    childProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdoutBuffer += output;
      
      // Procurar por eventos JSON na saída
      const lines = output.split('\n');
      
      for (const line of lines) {
        // Procurar pelo evento de download com URL
        if (line.includes('"event": "download"') || line.includes('"event":"download"')) {
          try {
            // Extrair os dados JSON
            const match = line.match(/{"event": ?"download", ?"data": ?({.*})}/);
            if (match && match.length === 2) {
              const eventData = JSON.parse(match[1]);
              
              if (eventData.url && !resEnviada) {
                console.log(`URL de download interceptada: ${eventData.url}`);
                downloadUrl = eventData.url;
                
                // Responder imediatamente ao cliente assim que a URL for detectada
                res.json({ 
                  success: true, 
                  url: downloadUrl,
                  chave,
                  message: 'URL interceptada com sucesso'
                });
                
                resEnviada = true;
                
                // Manter o processo rodando para completar as tarefas, mas a resposta já foi enviada
              }
            }
          } catch (e) {
            console.log('Erro ao processar evento JSON:', e);
          }
        }
        
        // Também tentar detectar URL de download diretamente relatada
        if (line.includes('URL de download detectada:') && !resEnviada) {
          const urlMatch = line.match(/URL de download detectada: (.+)/);
          if (urlMatch && urlMatch.length === 2) {
            console.log(`URL de download encontrada na saída: ${urlMatch[1]}`);
            downloadUrl = urlMatch[1];
            
            // Responder imediatamente ao cliente assim que a URL for detectada
            res.json({ 
              success: true, 
              url: downloadUrl,
              chave,
              message: 'URL interceptada com sucesso'
            });
            
            resEnviada = true;
            
            // Manter o processo rodando para completar as tarefas, mas a resposta já foi enviada
          }
        }
      }
    });
    
    // Lidar com erros e timeout mesmo se a resposta já tiver sido enviada
    childProcess.stderr.on('data', (data) => {
      console.error(`Erro no processo: ${data}`);
    });
    
    // Evento de finalização
    childProcess.on('close', (code) => {
      console.log(`Processo finalizado com código: ${code}`);
      
      // Se o processo terminou e ainda não enviamos uma resposta
      if (!resEnviada) {
        if (downloadUrl) {
          // URL foi encontrada mas não enviada
          res.json({ 
            success: true, 
            url: downloadUrl,
            chave,
            message: 'URL interceptada com sucesso'
          });
        } else {
          // Processo terminou sem encontrar URL
          res.status(404).json({ 
            success: false, 
            error: 'URL não encontrada', 
            message: 'Não foi possível interceptar a URL de download para esta chave' 
          });
        }
        resEnviada = true;
      }
    });
    
    // Timeout de segurança (3 minutos)
    setTimeout(() => {
      // Matar o processo se ainda estiver rodando
      try {
        if (childProcess.exitCode === null) {
          childProcess.kill();
          console.log('Processo finalizado por timeout de segurança');
        }
      } catch (e) {
        console.error('Erro ao finalizar processo:', e);
      }
      
      // Se ainda não enviamos uma resposta, enviar erro de timeout
      if (!resEnviada) {
        res.status(408).json({ 
          success: false, 
          error: 'Timeout de execução', 
          message: 'Tempo limite excedido (3 minutos) ao tentar interceptar a URL' 
        });
        resEnviada = true;
      }
    }, 3 * 60 * 1000);
    
  } catch (error) {
    console.error('Erro ao interceptar URL:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao interceptar URL', 
      message: error.message 
    });
  }
});

module.exports = router;
