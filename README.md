## Cyber browser built-in page
[中文文档](./README.zh-CN.md)
## Compiler Environment Requirements
- Node.js > 12

## Preparing dependencies
- Clone the cyfs-ts-sdk repository `git clone https://github.com/buckyos/cyfs-ts-sdk.git`
- In the root of the cyfs-ts-sdk repository, compile the h5 version of cyfs sdk `npm i && npm run build:h5`
- Copy the resulting `out/cyfs.d.ts` file to the `src/cyfs_sdk/` directory of this repository

## Development Debugging
- Install the CYFS browser and activate it correctly
- Run `npm run start`, which will replace the built-in pages in the CYFS browser with the local version

## Package
Run `npm run build` in the root directory and the files for the built-in pages will be generated in the `www` folder

## Directory description
- `src` The source files for the built-in pages  
- `tool` node tool script for handling directories and files   
- `www` The directory where the built-in pages are generated
