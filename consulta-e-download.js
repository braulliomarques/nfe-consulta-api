/**
 * Script para consulta completa e download de XML da NFe
 * Este script realiza o fluxo completo, incluindo autenticação, captcha e download
 * 
 * Uso:
 * node consulta-e-download.js CHAVE_NFE [--token2captcha TOKEN_2CAPTCHA]
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { Solver } = require('@2captcha/captcha-solver');
require('dotenv').config();

// Configurações
const TEMP_DIR = './temp';

// Extrair argumentos da linha de comando
let chaveAcesso = null;
let token2captcha = null;

// Processar argumentos da linha de comando
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  
  if (arg === '--token2captcha' && i + 1 < process.argv.length) {
    token2captcha = process.argv[i + 1];
    i++; // Pular o próximo argumento que é o valor do token
  } else if (!chaveAcesso) {
    // Se não é um argumento nomeado e ainda não temos a chave, considerar como a chave
    chaveAcesso = arg;
  }
}

// Usar o token fornecido ou o valor da variável de ambiente
const apiKey = token2captcha || process.env.CAPTCHA_API_KEY || '5a2c3841df7b3e6f069c0e67cf1622d8';
const solver = new Solver(apiKey);

// Criar diretório temporário se não existir
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Verificar se a chave foi fornecida
if (!chaveAcesso) {
  console.error('Erro: Informe a chave de acesso da NFe');
  console.error('Uso: node consulta-e-download.js CHAVE_NFE [--token2captcha TOKEN_2CAPTCHA]');
  process.exit(1);
}

console.log(`Iniciando processo para a chave: ${chaveAcesso}`);
console.log(`Token 2captcha: ${token2captcha ? 'Fornecido' : 'Usando valor padrão'}`);

// Configuração do certificado digital
const certificado = {
  path: path.resolve(__dirname, '09608375000103.pfx'),
  senha: 'Labor@123'
};

// Função para emitir eventos no console em formato JSON estruturado
function logEvent(evento, dados) {
  console.log(`{"event": "${evento}", "data": ${JSON.stringify(dados)}}`);
}

// Função para consulta completa e download
async function consultaCompleta(chaveAcesso) {
  console.log(`Iniciando consulta e download para chave: ${chaveAcesso}`);
  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  
  // Variáveis para controle de status
  let downloadSuccessful = false;
  let downloadUrl = null;
  let htmlContent = null;
  
  // Registrar evento de início
  logEvent("inicio_processo", {
    chave: chaveAcesso,
    timestamp: new Date().toISOString(),
    etapa: "inicializando"
  });
  
  // Iniciar navegador com suporte a certificado digital
  logEvent("etapa", { 
    descricao: "Iniciando navegador com certificado digital",
    porcentagem: 5
  });
  
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: 'new', // Modo headless moderno
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--allow-running-insecure-content',
        '--ignore-certificate-errors',
        '--disable-features=site-per-process',
        '--disable-gpu',
        '--window-size=1366,768'
      ],
      timeout: 60000, // Timeout de 60 segundos para iniciar o navegador
      ignoreHTTPSErrors: true
    });
    
    console.log('Navegador iniciado com sucesso');
  } catch (browserError) {
    console.error(`Erro ao iniciar navegador: ${browserError.message}`);
    throw new Error(`Falha ao iniciar navegador: ${browserError.message}`);
  }
  
  logEvent("etapa", { 
    descricao: "Navegador iniciado com sucesso",
    porcentagem: 10
  });
  
  let page = null;
  
  try {
    page = await browser.newPage();
    
    // Configurar handler para diálogos (alerts, confirms, prompts)
    page.on('dialog', async dialog => {
      console.log(`Diálogo detectado: ${dialog.type()}, mensagem: ${dialog.message()}`);
      logEvent("dialogo", {
        tipo: dialog.type(),
        mensagem: dialog.message(),
        acao: "aceitar"
      });
      // Aceitar automaticamente a caixa de confirmação sobre certificado digital
      await dialog.accept();
    });
    
    logEvent("etapa", { 
      descricao: "Configurando navegador", 
      porcentagem: 15 
    });
    
    // Configurar navegador para parecer mais humano
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    // Capturar cookies e headers sem interceptação de requisições
    let cookies = [];
    let responseHeaders = {};
    
    // Monitorar solicitações/respostas HTTP
    page.on('response', async response => {
      const url = response.url();
      
      if (url.includes('www.nfe.fazenda.gov.br')) {
        // Capturar cookies de resposta
        const responseCookies = response.headers()['set-cookie'];
        if (responseCookies) {
          cookies = [...cookies, ...responseCookies];
        }
        
        // Capturar headers de resposta
        const headers = response.headers();
        responseHeaders = {...responseHeaders, ...headers};
        
        // Registrar apenas páginas principais
        if (url.includes('consultaRecaptcha.aspx') || 
            url.includes('consultaResumo.aspx') || 
            url.includes('downloadNFe.aspx')) {
          logEvent("requisicao", {
            url: url,
            status: response.status(),
            tipo: "resposta"
          });
        }
      }
      
      // Capturar URL de download se for a da NFe
      if (url.includes('downloadNFe.aspx')) {
        console.log('URL de download detectada:', url);
        downloadUrl = url;
        logEvent("url_download", {
          url: url,
          detectada: true
        });
      }
    });
    
    // Acessar página de consulta com retry
    console.log('Acessando página da consulta NFe...');
    logEvent("etapa", { 
      descricao: "Acessando página de consulta da NFe", 
      porcentagem: 20 
    });
    
    // Função para tentar acessar a página com retries
    const acessarPaginaComRetry = async (url, maxRetries = 3) => {
      let lastError = null;
      
      for (let i = 0; i < maxRetries; i++) {
        try {
          console.log(`Tentativa ${i+1} de acessar a página...`);
          await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 90000 // Aumentar timeout para 90 segundos
          });
          return true;
        } catch (error) {
          console.error(`Erro na tentativa ${i+1}: ${error.message}`);
          lastError = error;
          
          // Verificar se o navegador ainda está conectado
          if (!page.browser().isConnected()) {
            console.error('Navegador foi desconectado, abortando...');
            throw new Error('Navegador desconectado durante a navegação');
          }
          
          // Esperar antes de tentar novamente
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      throw lastError || new Error('Falha ao acessar a página após múltiplas tentativas');
    };
    
    await acessarPaginaComRetry('https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=', 3);
    
    logEvent("etapa", { 
      descricao: "Página de consulta carregada", 
      porcentagem: 25 
    });
    
    // Esperar carregamento do hCaptcha
    console.log('Aguardando carregamento do hCaptcha...');
    logEvent("etapa", { 
      descricao: "Aguardando carregamento do captcha", 
      porcentagem: 30 
    });
    
    await page.waitForSelector('.h-captcha', { timeout: 30000 });
    
    // Extrair sitekey
    const sitekey = await page.evaluate(() => {
      const captchaElement = document.querySelector('.h-captcha');
      return captchaElement ? captchaElement.getAttribute('data-sitekey') : null;
    });
    
    if (!sitekey) {
      logEvent("erro", { 
        descricao: "Sitekey do captcha não encontrada", 
        tipo: "falha_captcha" 
      });
      throw new Error('Sitekey não encontrada');
    }
    
    console.log(`Sitekey encontrada: ${sitekey}`);
    logEvent("captcha", { 
      descricao: "Sitekey do captcha encontrada", 
      sitekey: sitekey 
    });
    
    // Preencher campo da chave de acesso
    console.log('Preenchendo campo da chave de acesso...');
    logEvent("etapa", { 
      descricao: `Preenchendo campo com a chave: ${chaveAcesso.substring(0, 10)}...`, 
      porcentagem: 35 
    });
    
    await page.evaluate((chaveAcesso) => {
      const campoChave = document.querySelector('#ctl00_ContentPlaceHolder1_txtChaveAcessoResumo');
      if (campoChave) {
        campoChave.value = chaveAcesso;
      } else {
        throw new Error('Campo de chave de acesso não encontrado');
      }
    }, chaveAcesso);
    
    // Verificar se o campo foi preenchido corretamente
    const valorCampo = await page.evaluate(() => {
      return document.querySelector('#ctl00_ContentPlaceHolder1_txtChaveAcessoResumo').value;
    });
    
    console.log(`Valor no campo da chave: ${valorCampo}`);
    
    if (valorCampo !== chaveAcesso) {
      console.log('Tentando preencher o campo novamente de forma tradicional...');
      logEvent("etapa", { 
        descricao: "Tentando preencher o campo novamente", 
        porcentagem: 38 
      });
      
      await page.click('#ctl00_ContentPlaceHolder1_txtChaveAcessoResumo', { clickCount: 3 }); // Seleciona todo o texto existente
      await page.type('#ctl00_ContentPlaceHolder1_txtChaveAcessoResumo', chaveAcesso);
    }
    
    // Resolver hCaptcha usando 2Captcha
    console.log('Resolvendo hCaptcha via 2Captcha...');
    logEvent("etapa", { 
      descricao: "Enviando captcha para resolução (2Captcha)", 
      porcentagem: 40 
    });
    
    try {
      const captchaResponse = await solver.hcaptcha({
        sitekey,
        pageurl: page.url()
      });
      
      console.log('hCaptcha resolvido com sucesso via 2Captcha');
      logEvent("etapa", { 
        descricao: "Captcha resolvido com sucesso via 2Captcha", 
        porcentagem: 50 
      });
      
      // Inserir a resposta do captcha no campo
      await page.evaluate((token) => {
        document.querySelector('[name="h-captcha-response"]').value = token;
      }, captchaResponse.data);
      
    } catch (captchaError) {
      console.error('Falha na resolução do captcha via 2Captcha:', captchaError.message);
      logEvent("erro", { 
        descricao: "Falha na resolução via 2Captcha", 
        erro: captchaError.message 
      });
      throw new Error('Falha na resolução do captcha: ' + captchaError.message);
    }
    
    console.log('Token hCaptcha inserido, clicando no botão de consulta...');
    logEvent("etapa", { 
      descricao: "Token de captcha inserido, enviando consulta", 
      porcentagem: 55 
    });
    
    // Clicar no botão e aguardar a navegação
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
      page.click('#ctl00_ContentPlaceHolder1_btnConsultarHCaptcha')
    ]);
    
    console.log('Navegação concluída para URL:', page.url());
    logEvent("etapa", { 
      descricao: "Formulário enviado, processando resultado", 
      porcentagem: 60,
      url: page.url()
    });
    
    // Verificar redirecionamento para a página de resultado
    if (!page.url().includes('consultaResumo.aspx')) {
      console.log('Redirecionamento não ocorreu corretamente, tentando navegação direta...');
      logEvent("etapa", { 
        descricao: "Redirecionamento não ocorreu, tentando navegação direta", 
        porcentagem: 65 
      });
      
      await page.goto('https://www.nfe.fazenda.gov.br/portal/consultaResumo.aspx?tipoConteudo=7PhJ+gAVw2g=', { 
        waitUntil: 'networkidle2',
        timeout: 60000
      });
    }
    
    // Aguardar carregamento de conteúdo da página
    await new Promise(resolve => setTimeout(resolve, 2000));
    logEvent("etapa", { 
      descricao: "Aguardando carregamento dos resultados", 
      porcentagem: 70 
    });
    
    // Salvar HTML da página para análise
    htmlContent = await page.content();
    const pageUrl = page.url();
    const filePath = `${TEMP_DIR}/nfe-${chaveAcesso}-${timestamp}.html`;
    fs.writeFileSync(filePath, htmlContent);
    console.log(`HTML da resposta salvo em: ${filePath}`);
    logEvent("etapa", { 
      descricao: "Página de resultado salva para análise", 
      porcentagem: 75,
      filePath: filePath
    });
    
    // Extrair dados da NFe
    logEvent("etapa", { 
      descricao: "Extraindo dados da NFe", 
      porcentagem: 80 
    });
    
    const dadosNFe = await page.evaluate((chaveAcesso) => {
      const dados = {};
      
      // Adicionar a chave de acesso consultada
      dados.chaveAcesso = chaveAcesso;
      
      // Extrai informações da div XSLTNFeResumida
      const divNFe = document.querySelector('.XSLTNFeResumida');
      if (divNFe) {
        // Extrair campos da nota
        const camposNFe = divNFe.querySelectorAll('.rowTP01');
        const dadosCompletos = {};
        
        camposNFe.forEach(campo => {
          const labels = campo.querySelectorAll('label');
          const valores = campo.querySelectorAll('p');
          
          for (let i = 0; i < labels.length; i++) {
            if (i < valores.length) {
              const chave = labels[i].innerText.trim();
              const valor = valores[i].innerText.trim();
              if (chave && valor) {
                dadosCompletos[chave] = valor;
              }
            }
          }
        });
        
        dados.detalhes = dadosCompletos;
        
        // Extrair campos importantes para acesso rápido
        const extrairCampo = (nome) => {
          return dadosCompletos[nome] || "N/A";
        };
        
        dados.emitente = extrairCampo("Emitente:");
        dados.destinatario = extrairCampo("Destinatário:");
        dados.valor = extrairCampo("Valor Total da Nota Fiscal:");
        dados.dataEmissao = extrairCampo("Data de Emissão:");
        dados.naturezaOperacao = extrairCampo("Natureza da Operação:");
        dados.status = extrairCampo("Situação da NF-e:");
      }
      
      return dados;
    }, chaveAcesso);
    
    const dadosEncontrados = Object.keys(dadosNFe).length > 1; // Mais que só a chave de acesso
    console.log('Dados extraídos:', dadosEncontrados ? 'Encontrados' : 'Vazio');
    
    logEvent("dados_nfe", { 
      encontrados: dadosEncontrados,
      quantidade: dadosNFe.detalhes ? Object.keys(dadosNFe.detalhes).length : 0,
      // Incluir dados extraídos para exibição
      emitente: dadosNFe.emitente || "N/A",
      destinatario: dadosNFe.destinatario || "N/A",
      valor: dadosNFe.valor || "N/A",
      dataEmissao: dadosNFe.dataEmissao || "N/A",
      naturezaOperacao: dadosNFe.naturezaOperacao || "N/A",
      status: dadosNFe.status || "N/A",
      // Incluir todos os detalhes
      detalhes: dadosNFe.detalhes || {}
    });
    
    // Verificar botão de download
    const botaoDownloadExiste = await page.evaluate(() => {
      return !!document.querySelector('#ctl00_ContentPlaceHolder1_btnDownload');
    });
    
    if (botaoDownloadExiste) {
      console.log('Botão de download encontrado, configurando para capturar o XML...');
      logEvent("etapa", { 
        descricao: "Botão de download encontrado, preparando para baixar XML", 
        porcentagem: 85 
      });
      
      // Configurar interceptação para capturar o download com tratamento de erros melhorado
      try {
        await page.setRequestInterception(true);
        
        page.on('request', async interceptedRequest => {
          if (interceptedRequest.url().includes('downloadNFe.aspx')) {
            console.log('Interceptando requisição de download:', interceptedRequest.url());
            downloadUrl = interceptedRequest.url();
            logEvent("download", { 
              descricao: "Requisição de download interceptada", 
              url: interceptedRequest.url() 
            });
            interceptedRequest.continue();
          } else {
            interceptedRequest.continue();
          }
        });
      } catch (interceptError) {
        console.error(`Erro ao configurar interceptação: ${interceptError.message}`);
        // Continue o processo, mesmo se a interceptação falhar
        logEvent("erro", { 
          descricao: "Erro ao configurar interceptação, continuando sem ela", 
          erro: interceptError.message 
        });
      }
      
      // Clicar no botão de download e aguardar
      await page.click('#ctl00_ContentPlaceHolder1_btnDownload');
      console.log('Botão de download clicado, aguardando diálogos e requisições...');
      logEvent("etapa", { 
        descricao: "Botão de download clicado, processando...", 
        porcentagem: 90 
      });
      
      // Aguardar um pouco para capturar a URL ou diálogo
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Desativar interceptação
      await page.setRequestInterception(false);
      
      if (downloadUrl) {
        console.log('URL de download capturada:', downloadUrl);
        logEvent("download", { 
          descricao: "URL de download capturada", 
          url: downloadUrl.substring(0, 100) + "..." // URL pode ser longa, então truncamos
        });
        
        // Salvar uma referência à URL de download
        const urlPath = `${TEMP_DIR}/download-url-${chaveAcesso}-${timestamp}.txt`;
        fs.writeFileSync(urlPath, downloadUrl);
        
        // Capturar os cookies atuais da página
        const pageCookies = await page.cookies();
        const cookieHeader = pageCookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        // Executar download com Puppeteer diretamente
        console.log('Tentando download direto com Puppeteer...');
        logEvent("etapa", { 
          descricao: "Iniciando download do XML", 
          porcentagem: 92 
        });
        
        try {
          const downloadResponse = await page.goto(downloadUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
          });
          
          const xmlContent = await downloadResponse.buffer();
          const xmlPath = `${TEMP_DIR}/nfe-${chaveAcesso}-${timestamp}.xml`;
          
          fs.writeFileSync(xmlPath, xmlContent);
          console.log(`XML baixado e salvo em: ${xmlPath}`);
          logEvent("etapa", { 
            descricao: "XML baixado e salvo", 
            porcentagem: 95,
            tamanho: xmlContent.length,
            caminho: xmlPath
          });
          
          // Verificar se o conteúdo contém a chave de acesso
          const contentStr = xmlContent.toString('utf8');
          logEvent("etapa", { 
            descricao: "Verificando conteúdo do XML", 
            porcentagem: 98
          });
          
          if (contentStr.includes(chaveAcesso)) {
            console.log('Verificação de conteúdo: XML contém a chave consultada.');
            logEvent("verificacao", { 
              descricao: "XML verificado com sucesso", 
              resultado: true,
              chaveEncontrada: true
            });
            
            // Marcar download como bem-sucedido
            downloadSuccessful = true;
            
            // Retornar resultado de sucesso
            return {
              success: true,
              html: filePath,
              xml: xmlPath,
              chaveAcesso: chaveAcesso,
              dados: dadosNFe
            };
          } else {
            console.error('ALERTA: O XML baixado não contém a chave consultada!');
            logEvent("verificacao", { 
              descricao: "Verificação de XML falhou", 
              resultado: false,
              erro: "XML não contém a chave consultada"
            });
            
            // Mesmo assim, salvar para análise
            const wrongXmlPath = `${TEMP_DIR}/wrong-nfe-${chaveAcesso}-${timestamp}.xml`;
            fs.writeFileSync(wrongXmlPath, xmlContent);
            
            return {
              success: false,
              error: 'O XML baixado não contém a chave consultada',
              html: filePath,
              wrongXml: wrongXmlPath
            };
          }
        } catch (downloadError) {
          console.error('Erro ao baixar XML:', downloadError.message);
          logEvent("erro", { 
            descricao: "Erro durante download do XML", 
            erro: downloadError.message
          });
          
          // Tentar baixar com método alternativo - salvar dados de sessão para uso futuro
          const sessionInfo = {
            url: downloadUrl,
            cookies: cookieHeader,
            chaveAcesso: chaveAcesso
          };
          
          const sessionPath = `${TEMP_DIR}/session-${chaveAcesso}-${timestamp}.json`;
          fs.writeFileSync(sessionPath, JSON.stringify(sessionInfo, null, 2));
          
          console.log(`Informações de sessão salvas em: ${sessionPath}`);
          logEvent("sessao", { 
            descricao: "Informações de sessão salvas para tentativa alternativa", 
            caminho: sessionPath
          });
          
          return {
            success: false,
            error: 'Falha no download do XML',
            sessionInfo: sessionPath,
            html: filePath
          };
        }
      } else {
        console.log('URL de download não detectada após clique no botão');
        logEvent("erro", { 
          descricao: "URL de download não detectada", 
          erro: "Nenhuma URL capturada após clicar no botão de download"
        });
        
        return {
          success: false,
          error: 'URL de download não detectada',
          html: filePath
        };
      }
    } else {
      console.log('Botão de download não encontrado na página');
      
      // Salvar o HTML atual para diagnóstico
      const htmlFilePath = path.join(TEMP_DIR, `erro-botao-${chaveAcesso}-${Date.now()}.html`);
      await page.screenshot({ path: path.join(TEMP_DIR, `erro-botao-${chaveAcesso}-${Date.now()}.png`) });
      fs.writeFileSync(htmlFilePath, await page.content());
      
      // Emitir um evento de erro mais completo
      logEvent("erro", { 
        descricao: "Botão de download não encontrado", 
        erro: "botao_download_nao_encontrado",
        reprocessamentoRecomendado: true,
        html: htmlFilePath
      });
      
      // Registrar no console para um formato compatível com a captura JSON
      console.log('{"event": "erro", "data": ' + JSON.stringify({
        descricao: "Botão de download não encontrado. Possível problema de captcha ou layout da página.",
        erro: "botao_download_nao_encontrado",
        reprocessamentoRecomendado: true,
        html: htmlFilePath
      }) + '}');
      
      // Verificar se existe alguma mensagem de erro na página
      const mensagemErro = await page.evaluate(() => {
        const msgElements = document.querySelectorAll('.alert-danger, .erro, .error');
        if (msgElements && msgElements.length > 0) {
          return msgElements[0].innerText.trim();
        }
        return null;
      });
      
      if (mensagemErro) {
        logEvent("erro_pagina", { 
          descricao: "Mensagem de erro encontrada na página", 
          mensagem: mensagemErro
        });
      }
      
      // Retornar um objeto mais completo para facilitar o tratamento do erro
      return {
        success: false,
        error: 'Botão de download não encontrado',
        errorType: 'botao_download_nao_encontrado',
        mensagemErro: mensagemErro || null,
        html: htmlFilePath,
        reprocessamentoRecomendado: true
      };
    }
  } catch (error) {
    console.error('Erro durante a consulta:', error);
    logEvent("erro", { 
      descricao: "Erro durante a consulta", 
      erro: error.message,
      stack: error.stack?.split('\n')[0] || "N/A"
    });
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    // Fechar o navegador com tratamento de erros
    if (browser) {
      try {
        await browser.close();
        console.log('Navegador fechado com sucesso');
      } catch (closeError) {
        console.error(`Erro ao fechar navegador: ${closeError.message}`);
      }
    }
    
    // Adicionar um indicador se o processo não foi concluído corretamente
    if (!downloadSuccessful && !downloadUrl) {
      // Se não conseguimos o download nem a URL, marcar como processamento incompleto
      logEvent('erro', {
        descricao: 'Processamento não foi concluído corretamente. O resultado final não foi obtido.',
        erro: 'processamento_incompleto',
        reprocessamentoRecomendado: true
      });
      
      // Salvar o HTML final para diagnóstico se tivermos conteúdo HTML
      if (htmlContent) {
        const htmlFilePath = path.join(TEMP_DIR, `incompleto-${chaveAcesso}-${Date.now()}.html`);
        fs.writeFileSync(htmlFilePath, htmlContent);
        console.log(`HTML da página incompleta salvo em: ${htmlFilePath}`);
      } else {
        console.log('Não foi possível salvar HTML da página, não disponível');
      }
      
      // Retornar resultado de falha
      console.log(JSON.stringify({
        success: false,
        error: 'Processamento incompleto',
        errorType: 'processamento_incompleto',
        reprocessamentoRecomendado: true
      }));
      process.exit(1);
    }
    
    // Retornar resultado de sucesso
    return {
      success: true, 
      downloadSuccessful,
      downloadUrl
    };
  }
}

// Executar função principal
consultaCompleta(chaveAcesso)
  .then(resultado => {
    console.log('\nResultado final:');
    console.log(JSON.stringify(resultado, null, 2));
    
    // Verificar se o processamento foi completo
    if (!resultado.downloadSuccessful && !resultado.downloadUrl) {
      // Se não conseguimos o download nem a URL, marcar como processamento incompleto
      console.log('{"event": "erro", "data": ' + JSON.stringify({
        descricao: 'Processamento não foi concluído corretamente. O resultado final não foi obtido.',
        erro: 'processamento_incompleto',
        reprocessamentoRecomendado: true
      }) + '}');
      
      // Atualizar o resultado para indicar processamento incompleto
      resultado.success = false;
      resultado.error = 'Processamento incompleto';
      resultado.errorType = 'processamento_incompleto';
      resultado.reprocessamentoRecomendado = true;
    }
    
    // Adicionar um evento para registro do fluxo
    console.log('{"event": "processo_concluido", "data": ' + JSON.stringify({
      chave: chaveAcesso,
      success: resultado.success,
      timestamp: new Date().toISOString(),
      detalhes: resultado.success ? 
        "XML baixado e verificado com sucesso" : 
        `Falha: ${resultado.error}`
    }) + '}');
    
    if (resultado.success) {
      console.log('Consulta e download concluídos com sucesso!');
      console.log(`XML disponível em: ${resultado.xml}`);
      process.exit(0);
    } else {
      console.log('A consulta ou download falhou.');
      console.log(`Erro: ${resultado.error}`);
      process.exit(1);
    }
  })
  .catch(erro => {
    console.error('Erro fatal na execução:', erro);
    console.log('{"event": "erro_fatal", "data": ' + JSON.stringify({
      chave: chaveAcesso,
      erro: erro.message,
      timestamp: new Date().toISOString()
    }) + '}');
    process.exit(1);
  });