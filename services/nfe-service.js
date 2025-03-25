const puppeteer = require('puppeteer');
const { Solver } = require('@2captcha/captcha-solver');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const apiKey = process.env.CAPTCHA_API_KEY;
const solver = new Solver(apiKey);

/**
 * Consulta dados de uma Nota Fiscal Eletrônica
 * @param {string} chaveAcesso - Chave de acesso da nota fiscal 
 * @param {Object} certificado - Objeto com informações do certificado digital
 * @param {string} certificado.path - Caminho do arquivo .pfx
 * @param {string} certificado.senha - Senha do certificado
 * @returns {Promise<object>} - Resultado da consulta
 */
async function consultarNFe(chaveAcesso, certificado) {
  // Criar pasta temporária se não existir
  const TEMP_DIR = './temp';
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Iniciar navegador com suporte a certificado digital
  const browser = await puppeteer.launch({
    headless: 'new', // Modo headless moderno
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--ignore-certificate-errors'
    ]
  });
  
  const page = await browser.newPage();
  
  // Configurar handler para diálogos (alerts, confirms, prompts)
  page.on('dialog', async dialog => {
    console.log(`Diálogo detectado: ${dialog.type()}, mensagem: ${dialog.message()}`);
    // Aceitar automaticamente a caixa de confirmação sobre certificado digital
    await dialog.accept();
  });
  
  try {
    console.log(`Iniciando consulta para NF-e: ${chaveAcesso}`);
    
    // Configurar navegador para parecer mais humano
    await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    // Capturar cookies e headers sem interceptação de requisições
    let cookies = [];
    let responseHeaders = {};
    
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
      }
    });
    
    // Acessar página de consulta
    console.log('Acessando página da consulta NFe...');
    await page.goto('https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    
    // Esperar carregamento do hCaptcha
    console.log('Aguardando carregamento do hCaptcha...');
    await page.waitForSelector('.h-captcha', { timeout: 30000 });
    
    // Extrair sitekey
    const sitekey = await page.evaluate(() => {
      const captchaElement = document.querySelector('.h-captcha');
      return captchaElement ? captchaElement.getAttribute('data-sitekey') : null;
    });
    
    if (!sitekey) {
      throw new Error('Sitekey não encontrada');
    }
    
    console.log(`Sitekey encontrada: ${sitekey}`);
    
    // Resolver hCaptcha usando 2Captcha
    console.log('Resolvendo hCaptcha via 2Captcha...');
    const captchaResponse = await solver.hcaptcha({
      sitekey,
      pageurl: page.url()
    });
    
    console.log('hCaptcha resolvido com sucesso');
    
    // Aguardar um pouco após resolver o captcha para evitar bloqueio
    console.log('Aguardando 2 segundos após resolver o captcha...');
    await sleep(2000);
    
    // Inserir a resposta do captcha no campo
    await page.evaluate((token) => {
      document.querySelector('[name="h-captcha-response"]').value = token;
    }, captchaResponse.data);
    
    // Aguardar mais um pouco antes de clicar no botão
    console.log('Aguardando 1 segundo antes de clicar no botão de consulta...');
    await sleep(1000);
    
    console.log('Token hCaptcha inserido, clicando no botão de consulta...');
    
    // Navegar para a página de resultado usando o Puppeteer
    try {
      // Clicar no botão e aguardar a navegação
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
        page.click('#ctl00_ContentPlaceHolder1_btnConsultarHCaptcha')
      ]);
      
      console.log('Navegação concluída para URL:', page.url());
      
      // Aguardar um pouco mais para garantir que a página carregou completamente
      console.log('Aguardando 3 segundos para carregamento completo da página...');
      await sleep(3000);
      
      // Verificar se fomos redirecionados para a página de resultado real
      if (!page.url().includes('consultaResumo.aspx')) {
        console.log('Redirecionamento não ocorreu corretamente, tentando navegar diretamente para a página de resultado...');
        
        // Tentar acessar diretamente a página de resultado com URL correta
        await page.goto('https://www.nfe.fazenda.gov.br/portal/consultaResumo.aspx?tipoConteudo=7PhJ+gAVw2g=', { 
          waitUntil: 'networkidle2',
          timeout: 60000
        });
        
        console.log('Acessando página de resultado diretamente:', page.url());
      }
      
      // Tentar localizar o resumo da NFe
      try {
        await page.waitForSelector('.XSLTNFeResumida', { timeout: 10000 });
        console.log('Página de resultado carregada com sucesso');
      } catch (e) {
        console.log('Elemento .XSLTNFeResumida não encontrado, continuando mesmo assim');
      }
      
      // Extrair conteúdo HTML e cookies atualizados
      const htmlContent = await page.content();
      const pageUrl = page.url();
      
      // Salvar HTML para análise
      const timestamp = new Date().toISOString().replace(/[:]/g, '-');
      const filePath = `${TEMP_DIR}/nfe-${chaveAcesso}-${timestamp}.html`;
      fs.writeFileSync(filePath, htmlContent);
      console.log(`HTML da resposta salvo em: ${filePath}`);
      
      // Extrair dados direto do Puppeteer
      const dadosNFe = await page.evaluate(() => {
        const dados = {};
        
        // Extrai informações da div XSLTNFeResumida
        const divNFe = document.querySelector('.XSLTNFeResumida');
        if (divNFe) {
          // Extrair campos da nota
          const camposNFe = divNFe.querySelectorAll('.rowTP01');
          camposNFe.forEach(campo => {
            const labels = campo.querySelectorAll('label');
            const valores = campo.querySelectorAll('p');
            
            for (let i = 0; i < labels.length; i++) {
              if (i < valores.length) {
                const chave = labels[i].innerText.trim();
                const valor = valores[i].innerText.trim();
                if (chave && valor) {
                  dados[chave] = valor;
                }
              }
            }
          });
          
          // Extrair produtos da tabela
          const tabelaProdutos = divNFe.querySelector('.tabNFe');
          if (tabelaProdutos) {
            const produtos = [];
            const linhasProdutos = tabelaProdutos.querySelectorAll('tbody tr');
            
            linhasProdutos.forEach((linha, index) => {
              // Pular a última linha que contém apenas o total
              if (index < linhasProdutos.length - 1) {
                const colunas = linha.querySelectorAll('td');
                if (colunas.length > 1) {
                  const produto = {
                    item: colunas[0].innerText.trim(),
                    descricao: colunas[1].innerText.trim(),
                    quantidade: colunas[2].innerText.trim(),
                    unidade: colunas[3].innerText.trim(),
                    valorUnitario: colunas[4].innerText.trim(),
                    valorTotal: colunas[5].innerText.trim()
                  };
                  produtos.push(produto);
                }
              }
            });
            
            dados.produtos = produtos;
            
            // Extrair valor total
            if (linhasProdutos.length > 0) {
              const ultimaLinha = linhasProdutos[linhasProdutos.length - 1];
              if (ultimaLinha) {
                const colunas = ultimaLinha.querySelectorAll('td');
                if (colunas.length > 5) {
                  dados.valorTotal = colunas[5].innerText.trim();
                }
              }
            }
          }
        }
        
        return dados;
      });
      
      console.log('Dados da NFe extraídos:', Object.keys(dadosNFe).length > 0 ? 'Encontrados' : 'Vazio');
      
      // Verificar se existe botão de download e fazer o download
      const botaoDownloadExiste = await page.evaluate(() => {
        return !!document.querySelector('#ctl00_ContentPlaceHolder1_btnDownload');
      });
      
      let xmlContent = null;
      let xmlPath = null;
      
      if (botaoDownloadExiste) {
        console.log('Botão de download encontrado, tentando baixar XML');
        
        // Configurar para aceitar todos os diálogos (confirmações) - MUITO IMPORTANTE para o certificado digital
        let dialogHandler = dialog => {
          console.log(`Diálogo detectado: ${dialog.type()}, mensagem: ${dialog.message()}`);
          dialog.accept(); // Clica em "OK" automaticamente
        };
        
        // Limpar qualquer listener antigo e adicionar o novo
        await page.removeAllListeners('dialog');
        page.on('dialog', dialogHandler);
        
        // Configurar um novo listener para capturar requisições de rede
        let downloadUrl = null;
        
        // Usar um evento de navegação para capturar a URL
        page.once('request', request => {
          const url = request.url();
          if (url.includes('downloadNFe.aspx')) {
            console.log('Requisição de download detectada:', url);
            downloadUrl = url;
          }
        });
        
        console.log('Listeners configurados, clicando no botão de download...');
        
        // Clicar no botão diretamente sem modificar o onclick
        try {
          // Primeiro clique simples para acionar o diálogo
          await page.click('#ctl00_ContentPlaceHolder1_btnDownload');
          console.log('Botão clicado, deverá aparecer a caixa de diálogo');
        } catch (e) {
          console.error('Erro ao clicar no botão:', e.message);
        }
        
        // Esperar um pouco para o navegador processar o clique
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('Botão de download clicado, verificando resultados');
        
        // Se não capturamos a URL durante a interceptação, vamos tentar obter a URL atual ou das histórico de navegação
        if (!downloadUrl) {
          console.log('Tentando métodos alternativos para obter a URL de download...');
          
          // Verificar URL atual
          const currentUrl = page.url();
          if (currentUrl.includes('downloadNFe.aspx')) {
            console.log('URL atual contém downloadNFe.aspx:', currentUrl);
            downloadUrl = currentUrl;
          } else {
            try {
              // Tentar obter através do histórico de navegação
              downloadUrl = await page.evaluate(() => {
                // 1. Verificar se há algum iframe ou link visível
                const links = Array.from(document.querySelectorAll('a, iframe'))
                  .filter(el => el.href || el.src)
                  .map(el => el.href || el.src)
                  .find(url => url && url.includes('downloadNFe.aspx'));
                
                if (links) return links;
                
                // 2. Verificar o histórico de desempenho para ver requisições recentes
                if (window.performance && window.performance.getEntries) {
                  const entries = window.performance.getEntries();
                  const downloadEntry = entries.find(e => e.name && e.name.includes('downloadNFe.aspx'));
                  if (downloadEntry) return downloadEntry.name;
                }
                
                // 3. Verificar atributos de dados em elementos
                const elementsWithData = Array.from(document.querySelectorAll('[data-url]'))
                  .find(el => el.dataset.url && el.dataset.url.includes('downloadNFe.aspx'));
                if (elementsWithData) return elementsWithData.dataset.url;
                
                return null;
              });
              
              if (downloadUrl) {
                console.log('URL de download encontrada via JavaScript:', downloadUrl);
              }
            } catch (e) {
              console.error('Erro ao tentar encontrar URL via JavaScript:', e.message);
            }
          }
          
          // Se ainda não encontramos, vamos tentar um último método - usar a URL esperada
          if (!downloadUrl) {
            console.log('Tentando URL padronizada para download...');
            const urlParams = new URLSearchParams(page.url().split('?')[1] || '');
            const tipoConteudo = urlParams.get('tipoConteudo') || '7PhJ+gAVw2g=';
            
            downloadUrl = `https://www.nfe.fazenda.gov.br/portal/downloadNFe.aspx?tipoConsulta=resumo&tipoConteudo=${tipoConteudo}`;
            console.log('URL de download construída manualmente:', downloadUrl);
          }
        }
        
        if (downloadUrl) {
          console.log('URL de download encontrada:', downloadUrl);
          
          // Verificar se o certificado existe
          if (!fs.existsSync(certificado.path)) {
            console.error(`Certificado não encontrado em: ${certificado.path}`);
          } else {
            // Tentar baixar o XML usando o certificado
            try {
              const https = require('https');
              const pfx = fs.readFileSync(certificado.path);
              
              const agent = new https.Agent({
                pfx: pfx,
                passphrase: certificado.senha,
                rejectUnauthorized: false
              });
              
              // Definir headers necessários para download
              const headers = {
                'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'Referer': page.url(),
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'same-origin'
              };
              
              // Verificar necessidade de adicionar cookies da página para a requisição
              const cookies = await page.cookies();
              if (cookies && cookies.length > 0) {
                const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
                headers['Cookie'] = cookieString;
                console.log('Cookies adicionados aos headers de download');
              }
              
              console.log('Iniciando download do XML com certificado...');
              const xmlResponse = await axios.get(downloadUrl, {
                httpsAgent: agent,
                headers,
                responseType: 'arraybuffer',
                timeout: 30000,
                maxRedirects: 5
              });
              
              if (xmlResponse.status === 200) {
                const contentType = xmlResponse.headers['content-type'] || '';
                // Salvar o XML em disco
                xmlContent = xmlResponse.data;
                xmlPath = `${TEMP_DIR}/nfe-${chaveAcesso}-${timestamp}.xml`;
                fs.writeFileSync(xmlPath, xmlContent);
                console.log(`XML baixado com sucesso (${xmlResponse.data.length} bytes) e salvo em: ${xmlPath}`);
                
                // Adicionar um arquivo texto com informações sobre a resposta
                const infoPath = `${TEMP_DIR}/nfe-${chaveAcesso}-${timestamp}-info.txt`;
                fs.writeFileSync(infoPath, `URL: ${downloadUrl}\nContent-Type: ${contentType}\nTamanho: ${xmlResponse.data.length} bytes\nData: ${new Date().toISOString()}`);
              } else {
                console.error('Resposta com status inválido:', xmlResponse.status);
              }
            } catch (error) {
              console.error('Erro ao baixar XML com certificado:', error.message);
              
              if (error.response) {
                console.error('  Status:', error.response.status);
                console.error('  Headers:', JSON.stringify(error.response.headers));
                
                // Salvar resposta de erro para debug
                if (error.response.data) {
                  const errorPath = `${TEMP_DIR}/error-${chaveAcesso}-${timestamp}.txt`;
                  fs.writeFileSync(errorPath, typeof error.response.data === 'string' 
                    ? error.response.data 
                    : Buffer.isBuffer(error.response.data)
                    ? error.response.data.toString('utf8', 0, 1000) + '...' // Limitar tamanho
                    : JSON.stringify(error.response.data));
                  console.log(`Resposta de erro salva em: ${errorPath}`);
                }
              }
              
              // Tentar um método alternativo - usar curl com o certificado diretamente
              try {
                console.log('Tentando baixar XML via curl como fallback...');
                
                // Criar um comando curl temporário
                const curlScript = `${TEMP_DIR}/download-${chaveAcesso}-${timestamp}.sh`;
                const curlCommand = `curl -k -v -L --cert-type P12 --cert "${certificado.path}:${certificado.senha}" "${downloadUrl}" -o "${TEMP_DIR}/nfe-curl-${chaveAcesso}-${timestamp}.xml"`;
                
                fs.writeFileSync(curlScript, curlCommand);
                fs.chmodSync(curlScript, '755');
                
                console.log(`Script curl criado em ${curlScript}`);
                console.log('Comando criado, você pode executá-lo manualmente para baixar o XML');
              } catch (alternativeError) {
                console.error('Erro ao criar script alternativo:', alternativeError.message);
              }
            }
          }
        } else {
          console.log('URL de download não encontrada após clicar no botão');
        }
      } else {
        console.log('Botão de download não encontrado na página');
      }
      
      // Retornar os dados obtidos
      return {
        success: true,
        html: htmlContent,
        xml: xmlContent !== null,
        xmlPath,
        url: pageUrl,
        filePath,
        dados: dadosNFe
      };
    } catch (error) {
      console.error('Erro durante a consulta HTTP:', error.message);
      throw error;
    }
    
  } catch (error) {
    console.error('Erro durante a consulta de NF-e:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
      console.log('Navegador fechado');
    }
  }
}

module.exports = {
  consultarNFe
};
