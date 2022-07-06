const fs = require("fs-extra")
const path = require('path')
const { getCyfsDir } =require('./utils.js')

async function initLib() {
    const origin = path.join(__dirname, '../src/js/lib')
    console.log('正在复制 js/lib 到浏览器 目录下...')
    fs.copySync(origin, path.join(getCyfsDir(), 'services/runtime/www/js/lib'))
    console.log('[完成]')
    console.log('正在复制 css 到浏览器 目录下...')
    fs.copySync(path.join(__dirname, '../src/css'), path.join(getCyfsDir(), 'services/runtime/www/css'))
    console.log('[完成]')
}

initLib()

