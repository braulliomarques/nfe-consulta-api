# API de Consulta e Download de NFe

Esta API fornece endpoints para consulta de Notas Fiscais Eletrônicas (NFe) e interceptação da URL de download.

## Configuração Inicial do Certificado Digital

Antes de usar a API, é necessário configurar o certificado digital:

1. Coloque seu certificado digital (.pfx) na pasta raiz do projeto
2. Renomeie o arquivo para `certificado.pfx`
3. Abra o arquivo `convert-forge.js` e atualize a senha do certificado:
   ```javascript
   const PFX_PASSWORD = 'Labor@123'; // Altere para a senha do seu certificado
   ```
4. Execute o script de conversão para gerar os arquivos PEM necessários:
   ```bash
   node convert-forge.js
   ```
5. Verifique se foram gerados os arquivos `cert.pem` e `key.pem` na pasta raiz

> **Importante**: O certificado digital é essencial para a API autenticar-se no portal da SEFAZ e acessar as notas fiscais. A conversão do formato PFX para PEM é necessária para que o sistema possa utilizar o certificado nas requisições HTTPS.

## Requisitos

- Node.js (v12 ou superior)
- NPM (v6 ou superior)

## Instalação

1. Clone este repositório
2. Entre na pasta da API
3. Instale as dependências:

```bash
npm install
```

## Configuração

O arquivo `.env` contém as configurações necessárias:

```
CAPTCHA_API_KEY=5a2c3841df7b3e6f069c0e67cf1622d8
PORT=3002
```

Certifique-se de que os certificados digitais estão presentes:
- `certificado.pfx` - Seu certificado digital original no formato PKCS#12
- `cert.pem` e `key.pem` - Certificados convertidos pelo script `convert-forge.js`

Se os arquivos PEM ainda não existirem, execute:
```bash
node convert-forge.js
```

## Executando a API

Para iniciar o servidor:

```bash
npm start
```

A API estará disponível em: http://localhost:3002

## Endpoints

### Interceptar URL de Download

Endpoint para interceptar a URL de download de uma NFe:

```
GET /api/nfe/interceptar-url/:chave
```

Parâmetros:
- `:chave` - Chave de acesso da NFe (44 dígitos)

Exemplo de requisição:

```bash
curl http://localhost:3002/api/nfe/interceptar-url/51250209608375000103550010000047211000141634
```

Exemplo de resposta:

```json
{
  "success": true,
  "url": "https://www.nfe.fazenda.gov.br/portal/downloadNFe.aspx?tipoConsulta=resumo&a=/FUbC0GSMHCJjbZ2NgfjZsg6TCH73LphlAQbw+OtsmBc5ekZWk7HifGG8RgIx/zC&tipoConteudo=7PhJ%20gAVw2g=&lp=L0ZVYkMwR1NNSENKamJaMk5nZmpac2c2VENINzNMcGhsQVFidytPdHNtQmM1ZWtaV2s3SGlmR0c4UmdJeC96Qw==",
  "chave": "51250209608375000103550010000047211000141634"
}
```

## Observações

- O processo utiliza o serviço 2Captcha para resolver o hCaptcha do portal da NFe
- O tempo de resposta pode variar dependendo da disponibilidade do serviço da SEFAZ e da resolução do captcha 

## Solução de Problemas

### Problemas com o Certificado

Se encontrar erros relacionados ao certificado, verifique:

1. Se o arquivo `certificado.pfx` está presente na raiz do projeto
2. Se a senha no arquivo `convert-forge.js` corresponde à senha do seu certificado
3. Se os arquivos `cert.pem` e `key.pem` foram gerados corretamente

Caso precise regenerar os arquivos PEM:
```bash
node convert-forge.js
```

### Erros de Conexão

Se a API retornar erros de conexão:

1. Verifique se o portal da SEFAZ está acessível
2. Certifique-se que o certificado digital é válido e não está expirado
3. Verifique se as informações do HTTP client (Agent) estão configuradas corretamente

Para testar a API com uma chave de NF-e específica:
```bash
node test-api.js CHAVE_NFE
``` 