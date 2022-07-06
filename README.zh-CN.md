# Cyber 浏览器 内置页

## 编译环境需求
- Node.js > 12

## 准备依赖
- 克隆cyfs-ts-sdk仓库`git clone https://github.com/buckyos/cyfs-ts-sdk.git`
- 在cyfs-ts-sdk仓库的根目录，编译h5版本的cyfs sdk`npm i && npm run build:h5`
- 将生成的`out/cyfs.d.ts`文件拷贝到本仓库的`src/cyfs_sdk/`目录下

## 开发调试
- 安装CYFS浏览器，并正确激活
- 运行`npm run start`, 即可将CYFS浏览器中的内置页替换成本地版本

# 打包
在根目录下运行`npm run build`，内置页的文件会生成到`www`文件夹下

## 目录说明
- `src` 内嵌页的源码文件  
- `tool`  处理目录和文件的node 工具脚本   
- `www`  内置页的生成目录