const fs = require('fs');
const forge = require('node-forge');
const path = require('path');

// Configuração
const PFX_PATH = path.resolve(__dirname, 'certificado.pfx');
const PFX_PASSWORD = 'Labor@123';
const CERT_OUTPUT = path.resolve(__dirname, 'cert.pem'); 
const KEY_OUTPUT = path.resolve(__dirname, 'key.pem');

try {
  // Ler o arquivo PFX
  const pfxData = fs.readFileSync(PFX_PATH);
  
  // Parsear o arquivo PFX
  const p12Asn1 = forge.asn1.fromDer(pfxData.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, PFX_PASSWORD);
  
  // Extrair certificados e chaves privadas
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const pkeyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  
  // Obter o primeiro certificado
  const certBag = certBags[forge.pki.oids.certBag][0];
  
  // Obter a primeira chave privada
  const pkeyBag = pkeyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0];
  
  // Converter para formato PEM
  const certPem = forge.pki.certificateToPem(certBag.cert);
  const keyPem = forge.pki.privateKeyToPem(pkeyBag.key);
  
  // Salvar os arquivos
  fs.writeFileSync(CERT_OUTPUT, certPem);
  fs.writeFileSync(KEY_OUTPUT, keyPem);
  
  console.log('Certificado PFX convertido com sucesso!');
  console.log(`Certificado: ${CERT_OUTPUT}`);
  console.log(`Chave privada: ${KEY_OUTPUT}`);
} catch (error) {
  console.error('Erro ao converter o certificado:', error.message);
}