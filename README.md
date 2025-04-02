# ATENÇÃO: PARA WINDOWS

 - Baixar Python e instalar
   Faça download em https://www.python.org/downloads/release/python-3120/
Antes de clicar em "Install Now", marque essa caixinha: ✅ Add Python to PATH
Isso é super importante — é o que faz o comando python e pip funcionarem no terminal.

Após instalar, crie uma pasta para o projeto, abra-o como terminal, e execute:
python.exe -m pip install --upgrade pip



 - Baixar GIT https://git-scm.com/download/win
      -Escolha uma das opções:
         32-bit Git for Windows Setup
         64-bit Git for Windows Setup.
 - Instale


-Abra PowerShell como administrador e execute o comando:

Set-ExecutionPolicy RemoteSigned

Crie uma pasta para clone do projeto, e abra-a com o terminal


e siga com o git clone https://github.com/braulliomarques/nfe-consulta-api
   

Após o GIT acesse o diretorio do projeto com o comando cd nfe-consulta-api





Siga com os procedimentos abaixo normalmente.


# API de Consulta de NFe

## O que é esta API?

Esta API é uma ferramenta que facilita a consulta de Notas Fiscais Eletrônicas (NFe) do portal da Receita Federal. Em termos simples, ela faz o trabalho pesado de acessar o portal oficial da NFe, preencher os dados necessários, resolver o captcha de segurança e retornar as informações da nota fiscal de forma organizada.

### Como funciona?

Imagine que você precisa consultar uma nota fiscal. Normalmente, você teria que:
1. Acessar o portal da Receita Federal
2. Preencher manualmente a chave da NFe
3. Resolver um captcha de segurança
4. Navegar por várias páginas para encontrar as informações

Nossa API automatiza todo esse processo. Você só precisa fornecer a chave da NFe, e ela:
1. Acessa automaticamente o portal
2. Preenche os dados necessários
3. Resolve o captcha automaticamente
4. Retorna todas as informações organizadas em um formato fácil de usar

### O que você recebe?

Quando você consulta uma NFe, a API retorna:
- Dados do emitente (quem emitiu a nota)
- Dados do destinatário (quem recebeu a nota)
- Data de emissão
- Status da nota (se está autorizada, cancelada, etc.)
- URL para download da nota fiscal
- E outras informações relevantes

### Como usar?

Você pode usar a API de várias formas:

1. **Usando o navegador (mais simples)**:
   - Acesse: `http://localhost:3002/api/nfe/interceptar-url?chave=SUA_CHAVE_NFE`
   - Substitua SUA_CHAVE_NFE pela chave da nota fiscal (44 dígitos)

2. **Usando o cliente Python**:
   ```bash
   ./nfe_api_client.py SUA_CHAVE_NFE
   ```

3. **Usando JavaScript**:
   ```javascript
   fetch('http://localhost:3002/api/nfe/interceptar-url', {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json'
     },
     body: JSON.stringify({
       chave: 'SUA_CHAVE_NFE'
     })
   })
   ```

### Requisitos para usar

1. A API precisa estar rodando no seu computador (ou servidor)
2. A chave da NFe deve ter 44 dígitos numéricos
3. É necessário ter uma conta no serviço 2Captcha (para resolver os captchas automaticamente)

### Exemplo de resposta

Quando você faz uma consulta, recebe algo assim:
```json
{
  "success": true,
  "url": "https://www.nfe.fazenda.gov.br/portal/downloadNFe.aspx?...",
  "chave": "51240301624149000457550010001270781003812344",
  "dadosNFe": {
    "encontrados": true,
    "quantidade": 14,
    "emitente": "NOME DO EMITENTE LTDA",
    "destinatario": "NOME DO DESTINATÁRIO",
    "dataEmissao": "01/03/2024",
    "naturezaOperacao": "VENDA DE MERCADORIA",
    "status": "AUTORIZADA"
  }
}
```

### Observações importantes

- A consulta pode levar alguns segundos para completar
- O processo é automatizado, mas respeita as regras do portal da Receita Federal
- Você pode usar a API para consultar quantas notas fiscais precisar
- A API é gratuita para uso local, mas requer uma conta no 2Captcha

# API de Consulta e Download de NFe

Esta API fornece endpoints para consulta de Notas Fiscais Eletrônicas (NFe) e interceptação da URL de download.

## Configuração Inicial do Certificado Digital

Antes de usar a API, é necessário configurar o certificado digital:






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

-Crie um arquivo .env no diretorio raiz,

O arquivo `.env` contém as configurações necessárias:

```
CAPTCHA_API_KEY=TOKEN_API_2CAPTCHA 
"
PORT=3002
```
Apague a extensão .txt do arquivo .env criado.

Como mostrar extensões de arquivos no Windows 

Abra o Explorer (Explorador de Arquivos)

Clique na aba "Exibir" no topo

Vá em "Mostrar" > "Extensões de nome de arquivo"

Marque essa opção ✅

Pronto! Agora você vai ver o .txt, .js, .json, etc., e poderá renomear corretamente para .env.


#Acesse https://2captcha.com/2captcha-api para contratação da api do captcha







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
POST /api/nfe/interceptar-url
```

Parâmetros (corpo da requisição):
- `chave` - Chave de acesso da NFe (44 dígitos)
- `token2captcha` - (Opcional) Token personalizado para o serviço 2Captcha

Exemplo de requisição:

```bash
# Requisição básica (sem token 2captcha)
curl -X POST http://localhost:3002/api/nfe/interceptar-url \
  -H "Content-Type: application/json" \
  -d '{"chave": "51240301624149000457550010001270781003812344"}'

# Requisição com token 2captcha
curl -X POST http://localhost:3002/api/nfe/interceptar-url \
  -H "Content-Type: application/json" \
  -d '{
    "chave": "51240301624149000457550010001270781003812344",
    "token2captcha": "f623a43b10acb451a2c276858c0e5f7b"
  }'
```

Exemplo de resposta:

```json
{
  "success": true,
  "url": "https://www.nfe.fazenda.gov.br/portal/downloadNFe.aspx?tipoConsulta=resumo&a=/FUbC0GSMHCJjbZ2NgfjZsg6TCH73LphlAQbw+OtsmBc5ekZWk7HifGG8RgIx/zC&tipoConteudo=7PhJ%20gAVw2g=&lp=L0ZVYkMwR1NNSENKamJaMk5nZmpac2c2VENINzNMcGhsQVFidytPdHNtQmM1ZWtaV2s3SGlmR0c4UmdJeC96Qw==",
  "chave": "51240301624149000457550010001270781003812344",
  "dadosNFe": {
    "encontrados": true,
    "quantidade": 14,
    "emitente": "NOME DO EMITENTE LTDA",
    "destinatario": "NOME DO DESTINATÁRIO",
    "valor": "N/A",
    "dataEmissao": "01/03/2024",
    "naturezaOperacao": "VENDA DE MERCADORIA",
    "status": "AUTORIZADA",
    "detalhes": {
      "campo1": "valor1",
      "campo2": "valor2"
    }
  },
  "message": "URL interceptada com sucesso"
}
```

> Nota: Existe também o endpoint `GET /api/nfe/interceptar-url/:chave` para compatibilidade, que funciona de maneira similar ao endpoint POST.

## Observações

- O processo utiliza o serviço 2Captcha para resolver o hCaptcha do portal da NFe
- O tempo de resposta pode variar dependendo da disponibilidade do serviço da SEFAZ e da resolução do captcha
- O token 2captcha é opcional - se não for fornecido, a API usará o token padrão configurado no arquivo .env
- Usar um token 2captcha personalizado pode ser útil para:
  - Ter mais controle sobre o saldo da conta 2captcha
  - Usar diferentes contas 2captcha para diferentes clientes
  - Evitar conflitos quando múltiplas requisições são feitas simultaneamente

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
