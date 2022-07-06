const fs = require("fs-extra")
const path = require('path')
const { getCyfsDir } =require('./utils.js')


async function main() {
    const origin = path.join(__dirname, '../cyfs-ts-sdk/out')

    // targe 1
    console.log('正在复制到工程目录下...')
    fs.copySync(origin, path.join(__dirname, '../src/cyfs_sdk'))
    console.log('[完成]')

    // targe 2
    console.log('正在复制到runtime调试目录下...')
    fs.copySync(origin, path.join(getCyfsDir(), 'services/runtime/www/cyfs_sdk'))
    console.log('[完成]')
}

main()

