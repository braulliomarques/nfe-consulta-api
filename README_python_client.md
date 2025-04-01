# Cliente Python para API de NFe

Este é um cliente Python para a API de Consulta e Download de NFe. Ele permite fazer requisições para interceptar a URL de download de uma NFe usando a API local.

## Requisitos

- Python 3.6 ou superior
- Pacote `requests`

## Instalação

1. Certifique-se de que o Python está instalado:
```bash
python --version
```

2. Instale a biblioteca `requests` caso ainda não tenha:
```bash
pip install requests
```

3. Torne o script executável:
```bash
chmod +x nfe_api_client.py
```

## Uso

### Executando com parâmetros padrão

```bash
./nfe_api_client.py CHAVE_NFE
```

### Executando com token 2captcha personalizado

```bash
./nfe_api_client.py CHAVE_NFE --token2captcha SEU_TOKEN_2CAPTCHA
```

### Opções disponíveis

```
usage: nfe_api_client.py [-h] [--host HOST] [--port PORT] [--token2captcha TOKEN2CAPTCHA] [chave]

Cliente Python para a API de NFe

positional arguments:
  chave                 Chave de acesso da NFe (44 dígitos)

optional arguments:
  -h, --help           show this help message and exit
  --host HOST          Host da API (padrão: localhost)
  --port PORT          Porta da API (padrão: 3002)
  --token2captcha TOKEN2CAPTCHA
                      Token personalizado para o serviço 2Captcha
```

### Exemplos

1. Usando uma chave específica:
```bash
./nfe_api_client.py 51240301624149000457550010001270781003812344
```

2. Usando uma chave com token 2captcha personalizado:
```bash
./nfe_api_client.py 51240301624149000457550010001270781003812344 --token2captcha f623a43b10acb451a2c276858c0e5f7b
```

3. Especificando um host e porta diferentes:
```bash
./nfe_api_client.py 51240301624149000457550010001270781003812344 --host 192.168.1.100 --port 3000
```

4. Usando todos os parâmetros:
```bash
./nfe_api_client.py 51240301624149000457550010001270781003812344 --host 192.168.1.100 --port 3000 --token2captcha f623a43b10acb451a2c276858c0e5f7b
```

## Exemplo de resposta

Se bem-sucedida, a requisição retornará algo como:

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
      "Emitente:": "NOME DO EMITENTE LTDA",
      "Destinatário:": "NOME DO DESTINATÁRIO",
      "Valor Total da Nota Fiscal:": "N/A",
      "Data de Emissão:": "01/03/2024"
    }
  },
  "message": "URL interceptada com sucesso"
}
```

## Observações

- O script exige que a API esteja rodando (por padrão em http://localhost:3002)
- A operação pode levar algum tempo devido à resolução de captcha no portal da NFe
- Verifique se a chave NFe é válida (44 dígitos numéricos)
- O timeout da requisição é de 3 minutos (180 segundos)
- O token 2captcha é opcional - se não for fornecido, a API usará o token padrão configurado no arquivo .env
- Usar um token 2captcha personalizado pode ser útil para:
  - Ter mais controle sobre o saldo da conta 2captcha
  - Usar diferentes contas 2captcha para diferentes clientes
  - Evitar conflitos quando múltiplas requisições são feitas simultaneamente 