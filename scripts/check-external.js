#!/usr/bin/env node
/**
 * Проверяет наличие 8th Wall runtime файлов перед сборкой клиента.
 * Запускается автоматически через prebuild:client в package.json.
 */

const fs = require('fs')
const path = require('path')

const REQUIRED = [
  'client/external/runtime/runtime.js',
  'client/external/xr/xr.js',
]

const root = path.resolve(__dirname, '..')
const missing = REQUIRED.filter(f => !fs.existsSync(path.join(root, f)))

if (missing.length > 0) {
  console.error('\n❌ Отсутствуют файлы 8th Wall runtime:')
  missing.forEach(f => console.error(`   ${f}`))
  console.error('\nПолучить их можно через 8th Wall Developer Portal.')
  console.error('Положить в client/external/ согласно структуре:')
  console.error('  client/external/runtime/runtime.js')
  console.error('  client/external/xr/xr.js\n')
  process.exit(1)
}

console.log('✓ 8th Wall runtime найден')
