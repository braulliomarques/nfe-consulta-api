/**
 * Rotas para processamento em lote de NFe
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const AdmZip = require('adm-zip');

// Diretório para arquivos temporários
const TEMP_DIR = './temp';
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Validar formato da chave de acesso da NF-e
function validarChaveAcesso(chave) {
  // Remove caracteres não numéricos
  chave = chave.replace(/[^\d]+/g, '');
  // Chave NFe deve ter 44 dígitos
  return chave.length === 44;
}

// Rota para download de arquivo ZIP com vários XMLs
router.post('/download-zip', async (req, res) => {
  try {
    const { files } = req.body;
    
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Lista de arquivos não fornecida ou vazia' 
      });
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
      return res.status(404).json({ 
        success: false,
        error: 'Nenhum arquivo válido encontrado' 
      });
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
    res.status(500).json({ 
      success: false,
      error: 'Erro ao gerar arquivo ZIP', 
      message: error.message 
    });
  }
});

module.exports = router;