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

def interceptar_url_nfe(chave_nfe, host="localhost", port=3002):
    """
    Faz uma requisição para a API para interceptar a URL de download de uma NFe
    
    Args:
        chave_nfe (str): Chave de acesso da NFe (44 dígitos)
        host (str): Host da API (padrão: localhost)
        port (int): Porta da API (padrão: 3002)
    
    Returns:
        dict: Resposta da API em formato de dicionário
    """
    url = f"http://{host}:{port}/api/nfe/interceptar-url/{chave_nfe}"
    
    print(f"Consultando API NFe: {url}")
    
    try:
        # Fazer a requisição para a API
        response = requests.get(url, timeout=180)  # Timeout de 3 minutos (mesmo da API)
        
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

def main():
    """Função principal do script"""
    # Configurar o parser de argumentos
    parser = argparse.ArgumentParser(description='Cliente Python para a API de NFe')
    parser.add_argument('chave', nargs='?', 
                      help='Chave de acesso da NFe (44 dígitos)')
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
    print("\nIniciando requisição...\n")
    
    resultado = interceptar_url_nfe(args.chave, args.host, args.port)
    
    if resultado:
        print("\n✅ SUCESSO:")
        print(json.dumps(resultado, indent=2))
        
        if resultado.get('url'):
            print(f"\n📋 URL interceptada com sucesso!")
            print(f"\nURL: {resultado['url']}")
    else:
        print("\n❌ A requisição falhou.")

if __name__ == "__main__":
    main() 