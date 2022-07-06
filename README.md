# cyber browser 浏览器 内嵌页



# 目录说明


cyfs-ts-sdk cyfs sdk submodule的目录  
src 内嵌页的源码文件  
tool  处理目录和文件的node 工具脚本   
www  build的目标目录


# 开发
先通过git submodule 下载sdk的源码  
然后
`npm run sdk` 生成sdk
然后再`npm run start`, 即可


# 打包
直接运行`npm run build`
会在当前目录下生成`www`文件夹