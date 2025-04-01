#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Cliente Python para a API de Consulta e Download de NFe
Permite fazer requisições para interceptar a URL de download de uma NFe
"""

import requests
import sys
import json
import argparse

def interceptar_url_nfe(chave_nfe, token2captcha=None, host="localhost", port=3002):
    """
    Faz uma requisição para a API para interceptar a URL de download de uma NFe
    
    Args:
        chave_nfe (str): Chave de acesso da NFe (44 dígitos)
        token2captcha (str, optional): Token da API 2captcha para resolver captchas
        host (str): Host da API (padrão: localhost)
        port (int): Porta da API (padrão: 3002)
    
    Returns:
        dict: Resposta da API em formato de dicionário
    """
    url = f"http://{host}:{port}/api/nfe/interceptar-url"
    
    # Preparar dados da requisição
    data = {
        "chave": chave_nfe
    }
    
    # Adicionar token 2captcha se fornecido
    if token2captcha:
        data["token2captcha"] = token2captcha
        print(f"Usando token 2captcha fornecido")
    
    print(f"Consultando API NFe: {url}")
    
    try:
        # Fazer a requisição para a API
        response = requests.post(url, json=data, timeout=180)  # Timeout de 3 minutos (mesmo da API)
        
        # Verificar se a requisição foi bem-sucedida
        response.raise_for_status()
        
        # Retornar os dados da resposta
        return response.json()
    
    except requests.exceptions.HTTPError as err:
        print(f"Erro HTTP: {err}")
        if response.text:
            try:
                print(f"Detalhes: {json.dumps(response.json(), indent=2)}")
            except:
                print(f"Resposta: {response.text}")
        return None
    
    except requests.exceptions.ConnectionError:
        print(f"Erro de conexão: Não foi possível conectar a {url}")
        print("Verifique se o servidor da API está rodando.")
        return None
    
    except requests.exceptions.Timeout:
        print("Erro: Timeout na requisição")
        print("A operação pode levar algum tempo devido à resolução de captcha.")
        return None
    
    except requests.exceptions.RequestException as err:
        print(f"Erro na requisição: {err}")
        return None

def exibir_dados_nfe(dados_nfe):
    """Exibe os dados da NFe de forma formatada"""
    if not dados_nfe or not isinstance(dados_nfe, dict):
        print("Sem dados para exibir")
        return
    
    print("\n📋 DADOS DA NFE:")
    print("==============================")
    
    if dados_nfe.get("encontrados"):
        print(f"Emitente: {dados_nfe.get('emitente', 'N/A')}")
        print(f"Destinatário: {dados_nfe.get('destinatario', 'N/A')}")
        print(f"Valor Total: {dados_nfe.get('valor', 'N/A')}")
        print(f"Data de Emissão: {dados_nfe.get('dataEmissao', 'N/A')}")
        print(f"Natureza da Operação: {dados_nfe.get('naturezaOperacao', 'N/A')}")
        print(f"Status: {dados_nfe.get('status', 'N/A')}")
        
        if dados_nfe.get("detalhes") and isinstance(dados_nfe["detalhes"], dict):
            print("\nDetalhes Completos:")
            print("------------------------------")
            for chave, valor in dados_nfe["detalhes"].items():
                print(f"{chave} {valor}")
    else:
        print("Não foi possível extrair dados detalhados da NFe")
    
    print("==============================")

def main():
    """Função principal do script"""
    # Configurar o parser de argumentos
    parser = argparse.ArgumentParser(description='Cliente Python para a API de NFe')
    parser.add_argument('chave', nargs='?', 
                      help='Chave de acesso da NFe (44 dígitos)')
    parser.add_argument('--token2captcha', 
                      help='Token da API 2captcha para resolver captchas')
    parser.add_argument('--host', default='localhost',
                      help='Host da API (padrão: localhost)')
    parser.add_argument('--port', type=int, default=3002,
                      help='Porta da API (padrão: 3002)')
    
    args = parser.parse_args()
    
    # Se não foi fornecida uma chave, usar uma chave de exemplo
    if not args.chave:
        args.chave = '51250209608375000103550010000047181000141540'
        print(f"Nenhuma chave fornecida. Usando chave de exemplo: {args.chave}")
    
    # Validar a chave (deve ter 44 dígitos)
    if not args.chave.isdigit() or len(args.chave) != 44:
        print("Erro: A chave deve conter 44 dígitos numéricos.")
        sys.exit(1)
    
    # Fazer a requisição
    print("\n========================================")
    print("Cliente Python para API de NFe")
    print("========================================")
    print(f"Chave NFe: {args.chave}")
    print(f"Servidor: http://{args.host}:{args.port}")
    if args.token2captcha:
        print(f"Token 2captcha: Fornecido")
    else:
        print(f"Token 2captcha: Não fornecido (usando valor padrão)")
    print("\nIniciando requisição...\n")
    
    resultado = interceptar_url_nfe(args.chave, args.token2captcha, args.host, args.port)
    
    if resultado:
        print("\n✅ SUCESSO:")
        print(json.dumps(resultado, indent=2))
        
        if resultado.get('url'):
            print(f"\n📋 URL interceptada com sucesso!")
            print(f"\nURL: {resultado['url']}")
            
        if resultado.get('dadosNFe'):
            exibir_dados_nfe(resultado['dadosNFe'])
    else:
        print("\n❌ A requisição falhou.")

if __name__ == "__main__":
    main() 