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
